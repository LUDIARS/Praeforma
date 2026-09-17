// Praeforma メイン Editor Window。 Window メニュー > LUDIARS > Praeforma から開く。
//
// タブ:
//   - Login: backend URL + PASETO token 設定
//   - Projects: Praeforma の project 一覧
//   - Feedback: 選択中 GameObject (= PraeformaPlaceholder) に紐付く FB 一覧 + 新規追加
//   - References: 選択中 GameObject の domain に紐付く外部 doc リンク (link/webview/markdown)

using System;
using System.Threading;
using System.Threading.Tasks;
using Ludiars.Praeforma.Editor.Views;
using Ludiars.Praeforma.Models;
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor
{
    public class PraeformaWindow : EditorWindow
    {
        private enum Tab { Login, Projects, Specifications, Instructions, Overlay, Feedback, References }
        private CancellationTokenSource lifetime;
        internal CancellationToken Lifetime => lifetime.Token;
        private SpecificationsView specifications;
        private InstructionsView instructions;
        private OverlayView overlay;

        private Tab _tab = Tab.Projects;
        private LoginView _login;
        private ProjectListView _projects;
        private FeedbackView _feedback;
        private ReferenceView _references;

        [MenuItem("Window/LUDIARS/Praeforma")]
        public static void Open()
        {
            var win = GetWindow<PraeformaWindow>();
            win.titleContent = new GUIContent("Praeforma");
            win.minSize = new Vector2(420, 480);
            win.Show();
        }

        private void OnEnable()
        {
            lifetime = new CancellationTokenSource();
            specifications = new SpecificationsView(this);
            instructions = new InstructionsView(this);
            overlay = new OverlayView();
            _login = new LoginView(this);
            _projects = new ProjectListView(this);
            _feedback = new FeedbackView(this);
            _references = new ReferenceView(this);
            if (!AuthStorage.CanConnect) _tab = Tab.Login;
        }

        private void OnDisable()
        {
            lifetime?.Cancel();
            lifetime?.Dispose();
        }

        private void OnGUI()
        {
            DrawHeader();
            DrawTabs();
            EditorGUILayout.Space(4);
            switch (_tab)
            {
                case Tab.Login:      _login.OnGUI(); break;
                case Tab.Projects:   _projects.OnGUI(); break;
                case Tab.Specifications: specifications.OnGUI(); break;
                case Tab.Instructions: instructions.OnGUI(); break;
                case Tab.Overlay: overlay.OnGUI(); break;
                case Tab.Feedback:   _feedback.OnGUI(); break;
                case Tab.References: _references.OnGUI(); break;
            }
        }

        private void DrawHeader()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Praeforma", EditorStyles.boldLabel, GUILayout.Width(80));
                EditorGUILayout.LabelField(string.IsNullOrEmpty(AuthStorage.LastProjectId)
                    ? "(no project)" : "project: " + Truncate(AuthStorage.LastProjectId, 24),
                    EditorStyles.miniLabel);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("⟳", EditorStyles.toolbarButton, GUILayout.Width(28)))
                    RefreshActiveTab();
            }
            EditorGUILayout.LabelField(AuthStorage.BaseUrl, EditorStyles.miniLabel);
        }

        private void DrawTabs()
        {
            var labels = new[] { "Login", "Projects", "Specifications", "Instructions", "Overlay", "Feedback", "References" };
            var idx = (int)_tab;
            var newIdx = GUILayout.SelectionGrid(idx, labels, 3);
            if (newIdx != idx)
            {
                _tab = (Tab)newIdx;
                RefreshActiveTab();
            }
        }

        public void RefreshActiveTab()
        {
            switch (_tab)
            {
                case Tab.Projects:   _ = SafeRun(_projects.Refresh); break;
                case Tab.Specifications: _ = SafeRun(specifications.Refresh); break;
                case Tab.Feedback:   _ = SafeRun(_feedback.Refresh); break;
                case Tab.References: _ = SafeRun(_references.Refresh); break;
            }
            Repaint();
        }

        public async Task SafeRun(Func<Task> action)
        {
            try { await action(); }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogError($"[Praeforma] {e.Message}");
            }
            if (this) Repaint();
        }

        private static string Truncate(string s, int max)
        {
            if (string.IsNullOrEmpty(s) || s.Length <= max) return s;
            return s.Substring(0, max - 1) + "…";
        }
    }
}
