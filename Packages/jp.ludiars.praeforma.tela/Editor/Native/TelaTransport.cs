using System;
using System.Collections.Generic;
using System.IO.Pipes;
using System.Security.Principal;
using System.Threading;

namespace Ludiars.Praeforma.Tela.Native
{
    // Owns the worker, queue, pipe and heartbeat. No Unity calls on this thread.
    internal sealed class TelaTransport : IDisposable
    {
        private readonly object gate = new object();
        private readonly Queue<Action> queue = new Queue<Action>();
        private readonly AutoResetEvent wake = new AutoResetEvent(false);
        private readonly TelaWire wire = new TelaWire();
        private readonly Thread worker;
        private readonly string name;
        private readonly IntPtr host;
        private NamedPipeClientStream pipe;
        private bool stopped, exited, disposed;
        private string error;
        internal string Error { get { lock (gate) return error; } }
        internal TelaTransport(string name, IntPtr host)
        {
            this.name = name; this.host = host;
            worker = new Thread(Run) { IsBackground = true, Name = "Praeforma Tela bridge" };
            try { worker.Start(); } catch { wake.Dispose(); throw; }
        }
        internal void Viewport(OverlayViewport viewport)
        {
            lock (gate)
            {
                if (stopped) return;
                // Geometry is replaceable state; keep only the newest pending viewport.
                queue.Clear();
                queue.Enqueue(() => {
                    ++wire.Revision;
                    Write(wire.Frame(2, w => { w.Write(viewport.X); w.Write(viewport.Y); w.Write(viewport.Width); w.Write(viewport.Height);
                        w.Write(viewport.Scale); w.Write(viewport.Visible); w.Write(viewport.Focused); }));
                });
                wake.Set();
            }
        }
        private void Write(byte[] message) => pipe.WriteAsync(message, 0, message.Length).GetAwaiter().GetResult();
        private void Run()
        {
            try
            {
                var created = new NamedPipeClientStream(".", name, PipeDirection.Out, PipeOptions.Asynchronous, TokenImpersonationLevel.Identification);
                lock (gate) { if (stopped) { created.Dispose(); return; } pipe = created; }
                created.Connect(5000);
                Write(wire.Frame(1, w => w.Write((ulong)host.ToInt64())));
                while (true)
                {
                    Action next;
                    lock (gate) { if (stopped) break; next = queue.Count > 0 ? queue.Dequeue() : null; }
                    if (next != null) next();
                    else if (!wake.WaitOne(1000)) Write(wire.Frame(6));
                }
            }
            catch (Exception exception) { lock (gate) { if (!stopped) error = exception.Message; } }
            finally { lock (gate) { stopped = true; pipe?.Dispose(); pipe = null; queue.Clear(); wake.Dispose(); exited = true; } }
        }
        public void Dispose()
        {
            lock (gate) { if (disposed) return; disposed = true; stopped = true; pipe?.Dispose(); if (!exited) wake.Set(); }
            if (!worker.Join(2000)) { lock (gate) error = "Tela transport did not stop within two seconds."; }
        }
    }
}
