// Projects タブ: backend から project 一覧を取得 + 選択。
// 選択した project は AuthStorage.LastProjectId に保存され、 Feedback /
// References タブのデフォルトになる。

using System.Threading.Tasks;
using Ludiars.Praeforma.Models;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal class ProjectListView
    {
        private readonly PraeformaWindow _win;
        private ProjectListResponse _data;
        private string _error;
        private Vector2 _scroll;
        private string _endpoint;
        private int _revision;
        private void SynchronizeEndpoint()
        {
            if (_endpoint == AuthStorage.BaseUrl) return;
            _endpoint = AuthStorage.BaseUrl;
            _data = null; _error = null; ++_revision;
        }

        public ProjectListView(PraeformaWindow win)
        {
            _win = win;
        }

        public async Task Refresh()
        {
            SynchronizeEndpoint();
            var revision = ++_revision;
            var endpoint = _endpoint;
            _error = null;
            try
            {
                var data = await PraeformaApi.ListProjects();
                if (revision == _revision && endpoint == AuthStorage.BaseUrl) _data = data;
            }
            catch (PraeformaApi.ApiException ae)
            {
                if (revision == _revision && endpoint == AuthStorage.BaseUrl) _error = $"HTTP {ae.Status} — {ae.Message}";
            }
            catch (System.Exception e)
            {
                if (revision == _revision && endpoint == AuthStorage.BaseUrl) _error = e.Message;
            }
        }

        public void OnGUI()
        {
            SynchronizeEndpoint();
            if (!AuthStorage.CanConnect)
            {
                EditorGUILayout.HelpBox("Login タブで PASETO token を設定してください。", MessageType.Warning);
                return;
            }

            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Projects", EditorStyles.boldLabel);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Reload", GUILayout.Width(80)))
                    _ = _win.SafeRun(Refresh);
            }

            if (_error != null) EditorGUILayout.HelpBox(_error, MessageType.Error);
            if (_data == null || _data.items == null)
            {
                EditorGUILayout.LabelField("(no data — push Reload)", EditorStyles.miniLabel);
                return;
            }

            var current = AuthStorage.LastProjectId;
            _scroll = EditorGUILayout.BeginScrollView(_scroll);
            foreach (var p in _data.items)
            {
                using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                {
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        EditorGUILayout.LabelField(p.name, EditorStyles.boldLabel);
                        GUILayout.FlexibleSpace();
                        var isActive = current == p.id;
                        GUI.enabled = !isActive;
                        if (GUILayout.Button(isActive ? "active" : "Activate", GUILayout.Width(90)))
                        {
                            AuthStorage.LastProjectId = p.id;
                            _win.Repaint();
                        }
                        GUI.enabled = true;
                    }
                    EditorGUILayout.LabelField(p.id, EditorStyles.miniLabel);
                    if (!string.IsNullOrEmpty(p.description))
                        EditorGUILayout.LabelField(p.description, EditorStyles.wordWrappedLabel);
                    if (p.platforms != null && p.platforms.Length > 0)
                        EditorGUILayout.LabelField("platforms: " + string.Join(", ", p.platforms),
                            EditorStyles.miniLabel);
                }
            }
            EditorGUILayout.EndScrollView();
        }
    }
}
