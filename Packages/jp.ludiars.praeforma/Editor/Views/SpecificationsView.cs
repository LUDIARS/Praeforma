// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal sealed class SpecificationsView
    {
        private readonly PraeformaWindow window;
        private string context, error;
        private EditorSpec[] items;
        private int offset, revision;
        private bool busy;
        private Vector2 scroll;
        public SpecificationsView(PraeformaWindow window) { this.window = window; }
        private string Context => InstructionDraftStore.Key(AuthStorage.BaseUrl, AuthStorage.LastProjectId);
        private void SynchronizeContext()
        {
            if (context == Context) return;
            context = Context; items = null; offset = 0; error = null; busy = false; ++revision;
        }
        public async Task Refresh()
        {
            SynchronizeContext();
            var requestRevision = ++revision;
            var requestContext = context;
            var projectId = AuthStorage.LastProjectId;
            busy = true; error = null; items = null;
            try
            {
                var page = await new EditorWorkspaceApi().Specifications(projectId, offset, window.Lifetime);
                if (requestRevision != revision || requestContext != Context) return;
                if (page.items == null || Array.Exists(page.items, item => item == null || item.projectId != projectId))
                    throw new InvalidOperationException("Pf returned an invalid project page.");
                items = page.items;
            }
            catch (OperationCanceledException) { /* Window lifecycle cancellation; no result is published. */ }
            catch (Exception e) { if (requestRevision == revision && requestContext == Context) error = e.Message; }
            finally { if (requestRevision == revision) busy = false; }
        }
        public void OnGUI()
        {
            SynchronizeContext();
            if (string.IsNullOrEmpty(AuthStorage.LastProjectId))
            { EditorGUILayout.HelpBox("Choose a Pf project in Projects.", MessageType.Info); return; }
            using (new EditorGUI.DisabledScope(busy))
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Reload")) _ = window.SafeRun(Refresh);
                using (new EditorGUI.DisabledScope(offset == 0))
                    if (GUILayout.Button("Previous")) { offset = Math.Max(0, offset - 50); _ = window.SafeRun(Refresh); }
                using (new EditorGUI.DisabledScope(items == null || items.Length < 50))
                    if (GUILayout.Button("Next")) { offset += 50; _ = window.SafeRun(Refresh); }
            }
            if (error != null) EditorGUILayout.HelpBox(error, MessageType.Error);
            if (items == null) { EditorGUILayout.LabelField(busy ? "Loading..." : "Reload to read specifications."); return; }
            if (items.Length == 0) EditorGUILayout.LabelField("No specifications on this page.");
            scroll = EditorGUILayout.BeginScrollView(scroll);
            foreach (var item in items)
            {
                using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                {
                    EditorGUILayout.LabelField(item.code + "  " + item.status + "  v" + item.version, EditorStyles.boldLabel);
                    EditorGUILayout.LabelField(item.title ?? "", EditorStyles.wordWrappedLabel);
                    EditorGUILayout.LabelField(item.description ?? "", EditorStyles.wordWrappedLabel);
                }
            }
            EditorGUILayout.EndScrollView();
        }
    }
}
