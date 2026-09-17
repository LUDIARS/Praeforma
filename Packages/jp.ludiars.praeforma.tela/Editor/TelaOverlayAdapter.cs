// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using Ludiars.Praeforma.Editor;
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
        public string Status => global::Tela.Editor.SceneOverlayConnection.Status;
        public void Connect(string localPipe) => global::Tela.Editor.SceneOverlayConnection.Connect(localPipe);
        public void Disconnect() => global::Tela.Editor.SceneOverlayConnection.Disconnect();
    }
}
