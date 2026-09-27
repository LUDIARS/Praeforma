using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Ludiars.Praeforma.Tela.Native
{
    public struct OverlayViewport
    {
        public int X, Y, Width, Height;
        public float Scale;
        public bool Visible, Focused;
    }
    public static class OverlayWindow
    {
        [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
        [DllImport("user32.dll")] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
        public static void RequireOwned(IntPtr window)
        {
            if (Environment.OSVersion.Platform != PlatformID.Win32NT) throw new PlatformNotSupportedException("Tela desktop overlay currently requires Windows.");
            GetWindowThreadProcessId(window, out var pid);
            using (var process = Process.GetCurrentProcess())
                if (!IsWindow(window) || pid != (uint)process.Id) throw new ArgumentException("The overlay host must belong to the calling application.");
        }
        public static bool Visible(IntPtr window) => IsWindow(window) && IsWindowVisible(window) && !IsIconic(window);
        public static bool Focused(IntPtr window) => GetForegroundWindow() == window;
        /** Put the separate overlay outside the app, falling back within the monitor work area. */
        public static OverlayViewport Beside(IntPtr window, int width, int height, float scale = 1)
        {
            if (width <= 0 || height <= 0 || scale <= 0 || float.IsNaN(scale) || float.IsInfinity(scale)) throw new ArgumentOutOfRangeException(nameof(width));
            if (!GetWindowRect(window, out var rect)) return new OverlayViewport { Scale = scale };
            var info = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
            if (!GetMonitorInfo(MonitorFromWindow(window, 2), ref info)) throw new InvalidOperationException("Cannot read the target monitor.");
            width = Math.Min(width, info.Work.Right - info.Work.Left); height = Math.Min(height, info.Work.Bottom - info.Work.Top);
            var x = rect.Right + 8;
            if (x + width > info.Work.Right) x = rect.Left - width - 8;
            x = Math.Max(info.Work.Left, Math.Min(x, info.Work.Right - width));
            return new OverlayViewport { X = x, Y = Math.Max(info.Work.Top, Math.Min(rect.Top, info.Work.Bottom - height)), Width = width, Height = height,
                Scale = scale, Visible = Visible(window), Focused = Focused(window) };
        }
    }
}
