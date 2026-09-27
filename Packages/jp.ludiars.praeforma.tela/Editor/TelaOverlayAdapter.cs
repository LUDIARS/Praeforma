// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using Ludiars.Praeforma.Editor;
using System;
using System.Reflection;
using UnityEditor;

namespace Ludiars.Praeforma.Tela.Editor
{
    [InitializeOnLoad]
    internal sealed class TelaOverlayAdapter : IOverlayConnection
    {
        private static readonly TelaOverlayAdapter instance = new TelaOverlayAdapter();
        static TelaOverlayAdapter()
        {
            OverlayConnection.Provider = instance;
            AssemblyReloadEvents.beforeAssemblyReload += () =>
            {
                if (ReferenceEquals(OverlayConnection.Provider, instance)) OverlayConnection.Provider = null;
            };
        }
        // Legacy Scene view support is optional. GameView owns its native companion and has no
        // dependency on an unreleased Tela.Editor API. Only bind the legacy public contract.
        private static readonly Type Connection = Type.GetType("Tela.Editor.SceneOverlayConnection, Tela.Editor");
        private const string Missing = "The legacy Tela SceneOverlayConnection API is unavailable. GameView specifications are available in the window above.";
        public string Status => Connection == null ? Missing : (string)(Connection.GetProperty("Status", BindingFlags.Public | BindingFlags.Static)?.GetValue(null) ?? Missing);
        private static MethodInfo RequireMethod(string name, params Type[] parameters)
            => Connection?.GetMethod(name, BindingFlags.Public | BindingFlags.Static, null, parameters, null)
                ?? throw new InvalidOperationException(Missing);
        public void Connect(string localPipe) => RequireMethod("Connect", typeof(string)).Invoke(null, new object[] { localPipe });
        public void Disconnect() => RequireMethod("Disconnect").Invoke(null, null);
    }
}
