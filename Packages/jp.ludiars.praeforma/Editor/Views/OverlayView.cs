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
            var provider = OverlayConnection.Provider;
            if (provider == null)
            {
                EditorGUILayout.HelpBox("Install the optional Praeforma Tela adapter and Tela Unity bridge to connect an overlay.", MessageType.Info);
                return;
            }
            EditorGUILayout.HelpBox("Start the Tela overlay through Excubitor, then connect the active Scene view here. Pf specifications remain in the Specifications tab.", MessageType.Info);
            pipe = EditorGUILayout.TextField("Local pipe", pipe);
            EditorGUILayout.LabelField("Connection", provider.Status, EditorStyles.wordWrappedLabel);
            if (error != null) EditorGUILayout.HelpBox(error, MessageType.Error);
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
