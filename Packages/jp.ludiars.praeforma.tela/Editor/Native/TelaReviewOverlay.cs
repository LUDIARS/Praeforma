using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text;

namespace Ludiars.Praeforma.Tela.Native
{
    /** The embedding application owns this companion process and must Dispose it at shutdown. */
    public sealed class TelaReviewOverlay : IDisposable
    {
        private Process process;
        private TelaTransport transport;
        private string file;
        private volatile string error;
        private volatile bool disposed;
        private OverlayViewport? lastViewport;
        public string Error => transport?.Error ?? error;
        public bool IsRunning => !disposed && process != null && !process.HasExited && Error == null;
        public TelaReviewOverlay(string executable, string font, string document, IntPtr host)
        {
            OverlayWindow.RequireOwned(host);
            if (!Path.IsPathRooted(executable) || !File.Exists(executable)) throw new FileNotFoundException("Select the Tela overlay executable.", executable);
            if (!string.Equals(Path.GetFileNameWithoutExtension(executable), "praeforma_overlay", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Select praeforma_overlay.exe, the Praeforma companion built with Tela.");
            if (!Path.IsPathRooted(font) || !File.Exists(font)) throw new FileNotFoundException("Select a font with Japanese glyphs.", font);
            if (string.IsNullOrEmpty(document) || !document.StartsWith("TELA_SCENE_OVERLAY 1\n", StringComparison.Ordinal)) throw new InvalidDataException("A Tela scene overlay document is required.");
            var pipe = "pf-review-" + Guid.NewGuid().ToString("N");
            try
            {
                file = Path.Combine(Path.GetTempPath(), pipe + ".tela");
                File.WriteAllText(file, document, new UTF8Encoding(false, true));
                process = new Process { StartInfo = new ProcessStartInfo {
                    FileName = executable, WorkingDirectory = Path.GetDirectoryName(executable),
                    Arguments = "--font " + Quote(font) + " --scene-overlay " + Quote(file) + " --pipe " + pipe,
                    UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true,
                }, EnableRaisingEvents = true };
                process.ErrorDataReceived += (_, args) => { if (!string.IsNullOrWhiteSpace(args.Data)) error = args.Data; };
                process.OutputDataReceived += (_, args) => { /* Drain diagnostics so the child cannot block on its pipe. */ };
                process.Exited += (_, args) => { if (!disposed) error = "Tela overlay exited. Refresh to reconnect."; };
                if (!process.Start()) throw new InvalidOperationException("Tela could not start.");
                process.BeginErrorReadLine(); process.BeginOutputReadLine();
                transport = new TelaTransport(pipe, host);
            }
            catch { Dispose(); throw; }
        }
        private static string Quote(string value)
        {
            if (value.IndexOf('"') >= 0 || value.IndexOf('\n') >= 0 || value.IndexOf('\r') >= 0) throw new ArgumentException("Invalid path.");
            return "\"" + value + "\"";
        }
        public void UpdateViewport(OverlayViewport viewport)
        {
            if (disposed) throw new ObjectDisposedException(nameof(TelaReviewOverlay));
            if (viewport.Width < 0 || viewport.Height < 0 || !(viewport.Scale > 0) || float.IsInfinity(viewport.Scale)) throw new ArgumentException("Invalid viewport.");
            if (lastViewport.HasValue && lastViewport.Value.Equals(viewport)) return;
            transport.Viewport(viewport);
            lastViewport = viewport;
        }
        public void Dispose()
        {
            if (disposed) return; disposed = true;
            transport?.Dispose(); transport = null;
            if (process != null)
            {
                try { if (!process.HasExited) { process.Kill(); if (!process.WaitForExit(3000)) error = "Tela process did not exit."; } }
                catch (InvalidOperationException) { /* The process may exit between the check and Kill. */ }
                catch (Win32Exception exception) { error = exception.Message; }
                finally { process.Dispose(); process = null; }
            }
            if (file != null)
            {
                try { File.Delete(file); }
                catch (IOException exception) { error = exception.Message; }
                catch (UnauthorizedAccessException exception) { error = exception.Message; }
                file = null;
            }
        }
    }
}
