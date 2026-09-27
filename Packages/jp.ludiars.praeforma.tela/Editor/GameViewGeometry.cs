using System;
using System.Reflection;
using System.Runtime.InteropServices;
using Ludiars.Praeforma.Tela.Native;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Tela.Editor
{
    // Unity has no public GameView draw-area API. Resolve it explicitly; never substitute the Scene view.
    internal static class GameViewGeometry
    {
        [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
        [DllImport("user32.dll")] private static extern bool LogicalToPhysicalPointForPerMonitorDPI(IntPtr window, ref Point point);
        private static readonly Type GameViewType = typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView");
        private static readonly PropertyInfo DrawArea = GameViewType?.GetProperty("viewInWindow", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        private static readonly PropertyInfo RenderTarget = GameViewType?.GetProperty("targetInView", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        internal static EditorWindow Find()
        {
            if (GameViewType == null || DrawArea == null || RenderTarget == null) throw new NotSupportedException("This Unity version does not expose the GameView drawing area.");
            var views = Resources.FindObjectsOfTypeAll(GameViewType);
            foreach (var view in views) if (view == EditorWindow.focusedWindow) return (EditorWindow)view;
            if (views.Length == 1) return (EditorWindow)views[0];
            throw new InvalidOperationException(views.Length == 0 ? "Open GameView first." : "Focus the GameView to attach.");
        }
        internal static IntPtr CaptureHost(EditorWindow view)
        {
            if (EditorWindow.focusedWindow != view) throw new InvalidOperationException("Focus GameView before connecting.");
            var host = GetAncestor(GetForegroundWindow(), 2);
            OverlayWindow.RequireOwned(host); return host;
        }
        internal static OverlayViewport Read(EditorWindow view, IntPtr host)
        {
            if (!view || EditorWindow.focusedWindow != view || !OverlayWindow.Visible(host)) return new OverlayViewport { Scale = 1 };
            var area = (Rect)DrawArea.GetValue(view);
            var target = (Rect)RenderTarget.GetValue(view);
            if (target.x < -1 || target.y < -1 || target.xMax > area.width + 1 || target.yMax > area.height + 1)
                throw new InvalidOperationException("Fit the whole game image inside GameView before using the overlay (reset zoom/pan).");
            area = new Rect(area.position + target.position, target.size);
            var topLeft = new Point { X = Mathf.RoundToInt(view.position.x + area.x), Y = Mathf.RoundToInt(view.position.y + area.y) };
            var bottomRight = new Point { X = Mathf.RoundToInt(view.position.x + area.xMax), Y = Mathf.RoundToInt(view.position.y + area.yMax) };
            if (!LogicalToPhysicalPointForPerMonitorDPI(host, ref topLeft) || !LogicalToPhysicalPointForPerMonitorDPI(host, ref bottomRight))
                throw new InvalidOperationException("Cannot convert GameView bounds to physical desktop pixels.");
            return new OverlayViewport { X = topLeft.X, Y = topLeft.Y, Width = bottomRight.X - topLeft.X, Height = bottomRight.Y - topLeft.Y,
                Scale = EditorGUIUtility.pixelsPerPoint, Visible = true, Focused = true };
        }
    }
}
