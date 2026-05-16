// References タブ: 選択中 GameObject の domain (= PraeformaPlaceholder.domainId) に
// 紐付く外部 doc リンクを表示。
//
// 表示モード:
//   - link (= 既定、 v0.1 で実装):     Application.OpenURL(url) で OS ブラウザを開く
//   - webview (v0.2+):                  Unity の WebView パッケージ前提、 stub
//   - markdown (v0.2+):                 Notion API / Google Docs API + 取得 markdown 表示
//
// 新規追加: title + url を入力 → kind は URL ホストから自動推定。

using System.Threading.Tasks;
using Ludiars.Praeforma.Models;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal class ReferenceView
    {
        private readonly PraeformaWindow _win;
        private ReferenceListResponse _data;
        private string _error;
        private Vector2 _scroll;
        private string _currentTargetKind;
        private string _currentTargetId;

        // 新規 form
        private string _newTitle = string.Empty;
        private string _newUrl = string.Empty;
        private string _newDescription = string.Empty;

        public ReferenceView(PraeformaWindow win)
        {
            _win = win;
        }

        public async Task Refresh()
        {
            _error = null;
            var projectId = AuthStorage.LastProjectId;
            if (string.IsNullOrEmpty(projectId)) { _data = null; return; }

            ResolveTarget();
            if (string.IsNullOrEmpty(_currentTargetKind) || string.IsNullOrEmpty(_currentTargetId))
            {
                _data = null;
                return;
            }

            try
            {
                _data = await PraeformaApi.ListReferences(
                    projectId, _currentTargetKind, _currentTargetId);
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

            ResolveTarget();
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("References", EditorStyles.boldLabel);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Reload", GUILayout.Width(80)))
                    _ = _win.SafeRun(Refresh);
            }

            if (string.IsNullOrEmpty(_currentTargetKind))
            {
                EditorGUILayout.HelpBox(
                    "Scene 上で PraeformaPlaceholder を持つ GameObject を選択してください。 "
                  + "その domain に紐づく外部 doc 参照を表示します。",
                    MessageType.Info);
                return;
            }

            EditorGUILayout.LabelField($"target: {_currentTargetKind} / {Truncate(_currentTargetId, 24)}",
                EditorStyles.miniLabel);

            EditorGUILayout.Space(4);
            DrawNewForm(projectId);
            EditorGUILayout.Space(8);

            if (_error != null) EditorGUILayout.HelpBox(_error, MessageType.Error);
            if (_data == null || _data.items == null || _data.items.Length == 0)
            {
                EditorGUILayout.LabelField("(no references — push Reload)", EditorStyles.miniLabel);
                return;
            }

            _scroll = EditorGUILayout.BeginScrollView(_scroll);
            foreach (var r in _data.items)
            {
                using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                {
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        EditorGUILayout.LabelField(KindBadge(r.kind) + " " + r.title, EditorStyles.boldLabel);
                        GUILayout.FlexibleSpace();
                        if (GUILayout.Button("Open in Browser", GUILayout.Width(140)))
                        {
                            if (!string.IsNullOrEmpty(r.url)) Application.OpenURL(r.url);
                        }
                    }
                    if (!string.IsNullOrEmpty(r.description))
                        EditorGUILayout.LabelField(r.description, EditorStyles.wordWrappedLabel);
                    EditorGUILayout.SelectableLabel(r.url, EditorStyles.miniLabel, GUILayout.Height(16));
                    if (r.display_mode != "link")
                    {
                        EditorGUILayout.HelpBox(
                            $"display_mode='{r.display_mode}' は v0.1 では未実装 — リンクで開きます",
                            MessageType.None);
                    }
                }
            }
            EditorGUILayout.EndScrollView();
        }

        private void DrawNewForm(string projectId)
        {
            using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
            {
                EditorGUILayout.LabelField("Add Reference", EditorStyles.boldLabel);
                _newTitle = EditorGUILayout.TextField("Title", _newTitle);
                _newUrl = EditorGUILayout.TextField("URL", _newUrl);
                _newDescription = EditorGUILayout.TextField("Description", _newDescription);

                using (new EditorGUILayout.HorizontalScope())
                {
                    GUILayout.FlexibleSpace();
                    GUI.enabled = !string.IsNullOrEmpty(_newTitle) && !string.IsNullOrEmpty(_newUrl);
                    if (GUILayout.Button("Add", GUILayout.Width(120)))
                    {
                        _ = _win.SafeRun(() => PostReference(projectId));
                    }
                    GUI.enabled = true;
                }
            }
        }

        private async Task PostReference(string projectId)
        {
            var req = new ReferenceCreateRequest
            {
                target_kind = _currentTargetKind,
                target_id = _currentTargetId,
                title = _newTitle,
                url = _newUrl,
                description = _newDescription,
                display_mode = "link",
            };
            await PraeformaApi.CreateReference(projectId, req);
            _newTitle = string.Empty;
            _newUrl = string.Empty;
            _newDescription = string.Empty;
            await Refresh();
        }

        private void ResolveTarget()
        {
            var go = Selection.activeGameObject;
            var ph = go != null ? go.GetComponent<PraeformaPlaceholder>() : null;
            if (ph != null && !string.IsNullOrEmpty(ph.domainId))
            {
                _currentTargetKind = "domain";
                _currentTargetId = ph.domainId;
            }
            else if (ph != null && !string.IsNullOrEmpty(ph.objectId))
            {
                _currentTargetKind = "object";
                _currentTargetId = ph.objectId;
            }
            else
            {
                _currentTargetKind = null;
                _currentTargetId = null;
            }
        }

        private static string KindBadge(string kind)
        {
            switch (kind)
            {
                case "notion":       return "📝";
                case "confluence":   return "📘";
                case "google-docs":  return "📄";
                case "google-sheet": return "📊";
                case "figma":        return "🎨";
                case "github":       return "💻";
                default:             return "🔗";
            }
        }

        private static string Truncate(string s, int max)
        {
            if (string.IsNullOrEmpty(s) || s.Length <= max) return s;
            return s.Substring(0, max - 1) + "…";
        }
    }
}
