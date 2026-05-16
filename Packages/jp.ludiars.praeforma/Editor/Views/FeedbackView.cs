// Feedback タブ: シーン上で選択中の GameObject (= PraeformaPlaceholder を持つ) に
// 紐付く FB 一覧 + 新規追加。
//
// 選択していない時はアクティブ project 全体の最新 FB 一覧を表示。

using System.Threading.Tasks;
using Ludiars.Praeforma.Models;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal class FeedbackView
    {
        private readonly PraeformaWindow _win;
        private FeedbackListResponse _data;
        private string _error;
        private Vector2 _scroll;

        // 新規 FB ドラフト
        private string _newTitle = string.Empty;
        private string _newBody = string.Empty;
        private string _newPriority = "medium";
        private string _newCategory = "question";
        private bool _useScenePosition = true;

        private static readonly string[] Priorities = { "low", "medium", "high", "critical" };
        private static readonly string[] Categories = { "bug", "feature", "improvement", "question", "spec-clarification" };

        public FeedbackView(PraeformaWindow win)
        {
            _win = win;
        }

        public async Task Refresh()
        {
            _error = null;
            var projectId = AuthStorage.LastProjectId;
            if (string.IsNullOrEmpty(projectId)) { _data = null; return; }

            var ph = GetSelectedPlaceholder();
            try
            {
                if (ph != null && !string.IsNullOrEmpty(ph.layoutObjectId))
                {
                    _data = await PraeformaApi.ListFeedback(projectId, layoutObjectId: ph.layoutObjectId);
                }
                else if (ph != null && !string.IsNullOrEmpty(ph.objectId))
                {
                    _data = await PraeformaApi.ListFeedback(projectId, objectId: ph.objectId);
                }
                else
                {
                    _data = await PraeformaApi.ListFeedback(projectId);
                }
            }
            catch (PraeformaApi.ApiException ae)
            {
                _error = $"HTTP {ae.Status} — {ae.Message}";
            }
            catch (System.Exception e)
            {
                _error = e.Message;
            }
        }

        public void OnGUI()
        {
            var projectId = AuthStorage.LastProjectId;
            if (string.IsNullOrEmpty(projectId))
            {
                EditorGUILayout.HelpBox("Projects タブで project をアクティブにしてください。", MessageType.Warning);
                return;
            }

            var ph = GetSelectedPlaceholder();
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Feedback", EditorStyles.boldLabel);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Reload", GUILayout.Width(80)))
                    _ = _win.SafeRun(Refresh);
            }

            if (ph != null)
            {
                EditorGUILayout.LabelField($"target: {ph.label} ({ph.placeholderShape})", EditorStyles.miniLabel);
                EditorGUILayout.LabelField($"layout_object_id: {Truncate(ph.layoutObjectId, 40)}", EditorStyles.miniLabel);
            }
            else
            {
                EditorGUILayout.LabelField("(no PraeformaPlaceholder selected — showing project-wide FB)", EditorStyles.miniLabel);
            }

            EditorGUILayout.Space(4);
            DrawNewForm(projectId, ph);
            EditorGUILayout.Space(8);

            if (_error != null) EditorGUILayout.HelpBox(_error, MessageType.Error);
            if (_data == null || _data.items == null)
            {
                EditorGUILayout.LabelField("(push Reload)", EditorStyles.miniLabel);
                return;
            }

            _scroll = EditorGUILayout.BeginScrollView(_scroll);
            foreach (var f in _data.items)
            {
                using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                {
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        EditorGUILayout.LabelField(StateBadge(f.state) + " " + f.title, EditorStyles.boldLabel);
                        GUILayout.FlexibleSpace();
                        EditorGUILayout.LabelField($"[{f.priority}/{f.category}]", EditorStyles.miniLabel,
                            GUILayout.Width(180));
                    }
                    if (!string.IsNullOrEmpty(f.body))
                        EditorGUILayout.LabelField(f.body, EditorStyles.wordWrappedLabel);
                    EditorGUILayout.LabelField(
                        $"created_by={Truncate(f.created_by, 12)} at={f.created_at}",
                        EditorStyles.miniLabel);
                    if (f.world_position != null && f.world_position.Length == 3)
                    {
                        if (GUILayout.Button("Focus in Scene View", GUILayout.Width(160)))
                        {
                            FocusSceneCamera(f.world_position);
                        }
                    }
                }
            }
            EditorGUILayout.EndScrollView();
        }

        private void DrawNewForm(string projectId, PraeformaPlaceholder ph)
        {
            using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
            {
                EditorGUILayout.LabelField("New Feedback", EditorStyles.boldLabel);
                _newTitle = EditorGUILayout.TextField("Title", _newTitle);
                EditorGUILayout.LabelField("Body (Markdown)", EditorStyles.miniLabel);
                _newBody = EditorGUILayout.TextArea(_newBody, GUILayout.MinHeight(60));

                using (new EditorGUILayout.HorizontalScope())
                {
                    _newPriority = Priorities[EditorGUILayout.Popup("Priority",
                        IndexOf(Priorities, _newPriority), Priorities)];
                    _newCategory = Categories[EditorGUILayout.Popup("Category",
                        IndexOf(Categories, _newCategory), Categories)];
                }

                _useScenePosition = EditorGUILayout.Toggle("Use scene camera position", _useScenePosition);

                using (new EditorGUILayout.HorizontalScope())
                {
                    GUILayout.FlexibleSpace();
                    GUI.enabled = !string.IsNullOrEmpty(_newTitle);
                    if (GUILayout.Button("Post Feedback", GUILayout.Width(160)))
                    {
                        _ = _win.SafeRun(() => PostFeedback(projectId, ph));
                    }
                    GUI.enabled = true;
                }
            }
        }

        private async Task PostFeedback(string projectId, PraeformaPlaceholder ph)
        {
            var req = new FeedbackCreateRequest
            {
                title = _newTitle,
                body = _newBody,
                priority = _newPriority,
                category = _newCategory,
                labels = new string[0],
            };
            if (ph != null)
            {
                req.layout_object_id = ph.layoutObjectId;
                req.object_id = ph.objectId;
                req.scene_path = HierarchyPath(ph.transform);
                var p = ph.transform.position;
                req.world_position = new[] { p.x, p.y, p.z };
            }
            else if (_useScenePosition && SceneView.lastActiveSceneView != null)
            {
                var p = SceneView.lastActiveSceneView.pivot;
                req.world_position = new[] { p.x, p.y, p.z };
            }

            await PraeformaApi.CreateFeedback(projectId, req);
            _newTitle = string.Empty;
            _newBody = string.Empty;
            await Refresh();
        }

        private static PraeformaPlaceholder GetSelectedPlaceholder()
        {
            var go = Selection.activeGameObject;
            if (go == null) return null;
            return go.GetComponent<PraeformaPlaceholder>();
        }

        private static string HierarchyPath(Transform t)
        {
            if (t == null) return null;
            var path = t.name;
            while (t.parent != null)
            {
                t = t.parent;
                path = t.name + "/" + path;
            }
            return path;
        }

        private static void FocusSceneCamera(float[] pos)
        {
            var sv = SceneView.lastActiveSceneView;
            if (sv == null) return;
            sv.pivot = new Vector3(pos[0], pos[1], pos[2]);
            sv.Repaint();
        }

        private static int IndexOf(string[] arr, string v)
        {
            for (int i = 0; i < arr.Length; i++) if (arr[i] == v) return i;
            return 0;
        }

        private static string StateBadge(string s)
        {
            switch (s)
            {
                case "in-progress": return "[●]";
                case "resolved":    return "[✓]";
                case "wont-fix":    return "[✗]";
                default:            return "[○]";
            }
        }

        private static string Truncate(string s, int max)
        {
            if (string.IsNullOrEmpty(s) || s.Length <= max) return s;
            return s.Substring(0, max - 1) + "…";
        }
    }
}
