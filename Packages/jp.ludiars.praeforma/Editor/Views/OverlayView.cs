// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal sealed class OverlayView
    {
        private string pipe = "tela-scene", error;
        public void OnGUI()
        {
            EditorGUILayout.HelpBox("GameView の仕様・関連シナリオは Window > LUDIARS > Praeforma GameView Overlay から開きます。Tela アダプターが必要です。現在の Unity シーンに追従します。", MessageType.Info);
            if (GUILayout.Button("Open GameView specification overlay"))
            {
                if (!EditorApplication.ExecuteMenuItem("Window/LUDIARS/Praeforma GameView Overlay"))
                    error = "Install the optional Praeforma Tela adapter to use the GameView overlay.";
            }
            if (error != null) EditorGUILayout.HelpBox(error, MessageType.Error);
            var provider = OverlayConnection.Provider;
            if (provider == null)
            {
                EditorGUILayout.HelpBox("Install the optional Praeforma Tela adapter and Tela Unity bridge to connect an overlay.", MessageType.Info);
                return;
            }
            EditorGUILayout.HelpBox("Legacy Scene view connection: start Tela through Excubitor, then connect here. GameView specifications use the separate window above.", MessageType.Info);
            pipe = EditorGUILayout.TextField("Local pipe", pipe);
            EditorGUILayout.LabelField("Connection", provider.Status, EditorStyles.wordWrappedLabel);
            if (GUILayout.Button("Connect active Scene view")) Run(() => provider.Connect(pipe));
            if (GUILayout.Button("Disconnect")) Run(provider.Disconnect);
        }
        private void Run(Action action)
        {
            error = null;
            try { action(); }
            catch (Exception e) { error = e.Message; }
        }
    }
}
