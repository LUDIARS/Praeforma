// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal sealed class InstructionsView
    {
        private readonly PraeformaWindow window;
        private InstructionDraft draft;
        private string key, error;
        private bool busy;
        public InstructionsView(PraeformaWindow window) { this.window = window; }
        private string Context => InstructionDraftStore.Key(AuthStorage.BaseUrl, AuthStorage.LastProjectId);
        private void SynchronizeContext()
        {
            if (key == Context) return;
            key = Context; draft = InstructionDraftStore.Load(key); error = null; busy = false;
        }
        public void OnGUI()
        {
            SynchronizeContext();
            if (string.IsNullOrEmpty(AuthStorage.LastProjectId))
            { EditorGUILayout.HelpBox("Choose a Pf project in Projects.", MessageType.Info); return; }
            EditorGUILayout.HelpBox("Save a request to Pf. Saving does not execute it in Unity or start AI work.", MessageType.Info);
            using (new EditorGUI.DisabledScope(draft.Frozen || busy))
            {
                EditorGUI.BeginChangeCheck();
                draft.text = EditorGUILayout.TextArea(draft.text, GUILayout.MinHeight(140));
                if (GUILayout.Button("Use selected Unity object as target"))
                {
                    var selected = Selection.activeObject;
                    draft.target = selected ? selected.name + "\n" + GlobalObjectId.GetGlobalObjectIdSlow(selected) : "";
                    InstructionDraftStore.Save(key, draft);
                }
                if (EditorGUI.EndChangeCheck()) InstructionDraftStore.Save(key, draft);
            }
            EditorGUILayout.LabelField("Captured target", draft.target, EditorStyles.wordWrappedLabel);
            if (error != null) EditorGUILayout.HelpBox(error, MessageType.Error);
            if (!string.IsNullOrEmpty(draft.savedId))
            {
                EditorGUILayout.HelpBox("Saved to Pf: " + draft.savedId, MessageType.Info);
                if (GUILayout.Button("New instruction")) { draft = new InstructionDraft(); InstructionDraftStore.Save(key, draft); }
                return;
            }
            using (new EditorGUI.DisabledScope(busy))
            {
                if (GUILayout.Button(draft.Frozen ? "Retry the same saved request" : "Save instruction to Pf"))
                    _ = window.SafeRun(Send);
                if (draft.Frozen && GUILayout.Button("Discard local draft") && EditorUtility.DisplayDialog("Discard draft?",
                    "Pf may already have received this request. Check Pf before creating another copy.", "Discard", "Keep"))
                { draft = new InstructionDraft(); InstructionDraftStore.Save(key, draft); }
            }
        }
        private async Task Send()
        {
            var requestKey = key;
            var requestDraft = draft;
            var projectId = AuthStorage.LastProjectId;
            busy = true; error = null;
            try
            {
                var api = new EditorWorkspaceApi();
                var body = requestDraft.Freeze(Guid.NewGuid().ToString());
                InstructionDraftStore.Save(requestKey, requestDraft);
                var response = await api.SaveInstruction(projectId, body, window.Lifetime);
                requestDraft.Acknowledge(response.fragment, projectId);
                InstructionDraftStore.Save(requestKey, requestDraft);
                if (requestKey == key && draft.eventId == requestDraft.eventId) draft = requestDraft;
            }
            catch (OperationCanceledException) { /* Persisted frozen request supports an explicit retry after reopening. */ }
            catch (Exception e) { if (requestKey == Context) error = e.Message; }
            finally { if (requestKey == Context) busy = false; }
        }
    }
}
