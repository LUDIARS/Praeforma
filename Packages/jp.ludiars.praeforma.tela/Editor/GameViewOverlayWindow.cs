using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Ludiars.Praeforma.Editor;
using Ludiars.Praeforma.Tela.Native;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Ludiars.Praeforma.Tela.Editor
{
    /** Owns scene detection, cancellation and one Tela companion. Reload/quitting always dispose it. */
    public sealed class GameViewOverlayWindow : EditorWindow
    {
        private string executable, font, status, error, sceneKey, bindingKey, layoutId;
        private string manualSceneKey, manualLayoutId;
        private EditorScene[] scenes = Array.Empty<EditorScene>();
        private CancellationTokenSource request;
        private TelaReviewOverlay overlay;
        private EditorWindow gameView;
        private IntPtr host;
        private bool enabledOverlay, busy, disposed;
        private double nextUpdate;

        [MenuItem("Window/LUDIARS/Praeforma GameView Overlay")]
        public static void Open() => GetWindow<GameViewOverlayWindow>("Pf GameView").Show();
        private void OnEnable()
        {
            disposed = false;
            executable = EditorPrefs.GetString("Praeforma.Tela.Executable", ""); font = EditorPrefs.GetString("Praeforma.Tela.Font", "");
            EditorApplication.update += UpdateOverlay;
            AssemblyReloadEvents.beforeAssemblyReload += Stop;
            EditorApplication.quitting += Stop;
        }
        private void OnDisable()
        {
            disposed = true; Stop(); EditorApplication.update -= UpdateOverlay;
            AssemblyReloadEvents.beforeAssemblyReload -= Stop; EditorApplication.quitting -= Stop;
        }
        private void Stop()
        {
            enabledOverlay = false; request?.Cancel(); request?.Dispose(); request = null;
            overlay?.Dispose(); overlay = null; busy = false;
        }
        private void OnGUI()
        {
            EditorGUILayout.LabelField("現在のシーン", SceneManager.GetActiveScene().name);
            EditorGUILayout.LabelField("Pf プロジェクト", AuthStorage.LastProjectId ?? "未選択");
            EditorGUILayout.HelpBox("仕様と要素を GameView 上に表示します。関連シナリオ・仕様ページは Tela オーバーレイ上で選択できます。", MessageType.Info);
            executable = EditorGUILayout.TextField("praeforma_overlay.exe", executable);
            font = EditorGUILayout.TextField("日本語フォント (.ttf)", font);
            if (scenes.Length > 0)
            {
                var names = new[] { "対応する Pf シーンを選択" }.Concat(scenes.Select(scene => scene.name)).ToArray();
                var index = Array.FindIndex(scenes, scene => scene.id == layoutId) + 1;
                var next = EditorGUILayout.Popup("Pf シーン", index, names);
                if (next != index)
                {
                    layoutId = next == 0 ? null : scenes[next - 1].id;
                    manualSceneKey = CurrentSceneKey(SceneManager.GetActiveScene()); manualLayoutId = layoutId;
                    if (bindingKey != null) { if (layoutId == null) EditorPrefs.DeleteKey(bindingKey); else EditorPrefs.SetString(bindingKey, layoutId); }
                    sceneKey = null;
                    if (enabledOverlay && gameView) gameView.Focus();
                }
            }
            EditorGUILayout.LabelField(status ?? "停止中", EditorStyles.wordWrappedLabel);
            if (!string.IsNullOrEmpty(error)) EditorGUILayout.HelpBox(error, MessageType.Error);
            using (new EditorGUI.DisabledScope(busy))
            {
                if (GUILayout.Button(enabledOverlay ? "仕様を再取得" : "仕様オーバーレイを開始")) Begin();
            }
            if (GUILayout.Button("停止")) Stop();
        }
        private void Begin()
        {
            error = null;
            try
            {
                if (string.IsNullOrWhiteSpace(AuthStorage.LastProjectId)) throw new InvalidOperationException("Select a project in the Praeforma window.");
                EditorEndpoint.Capture();
                gameView = GameViewGeometry.Find(); gameView.Focus();
                // Binding is deferred until Unity has actually focused the selected GameView.
                enabledOverlay = true; sceneKey = null;
                EditorPrefs.SetString("Praeforma.Tela.Executable", executable); EditorPrefs.SetString("Praeforma.Tela.Font", font);
            }
            catch (Exception exception) { error = exception.Message; enabledOverlay = false; }
        }
        private void UpdateOverlay()
        {
            if (!enabledOverlay || EditorApplication.timeSinceStartup < nextUpdate) return;
            nextUpdate = EditorApplication.timeSinceStartup + 0.1;
            try
            {
                if (!gameView) throw new InvalidOperationException("GameView was closed. Open it and reconnect.");
                var scene = SceneManager.GetActiveScene();
                var key = CurrentSceneKey(scene);
                if (EditorWindow.focusedWindow == gameView && host != IntPtr.Zero && GameViewGeometry.CaptureHost(gameView) != host)
                    sceneKey = null; // Docking can replace the native host without changing the Unity scene.
                if (key != sceneKey)
                {
                    // Hide immediately when a scene changes, even while another Editor tab has focus.
                    request?.Cancel(); overlay?.Dispose(); overlay = null;
                    if (EditorWindow.focusedWindow != gameView) { busy = false; return; }
                    host = GameViewGeometry.CaptureHost(gameView);
                    sceneKey = key; request?.Cancel(); request?.Dispose(); request = new CancellationTokenSource();
                    // Never show the previous scene's specifications while the new request is pending.
                    _ = LoadScene(scene, request.Token);
                }
                if (overlay != null)
                {
                    if (!overlay.IsRunning) throw new InvalidOperationException(overlay.Error ?? "Tela is no longer running.");
                    overlay.UpdateViewport(GameViewGeometry.Read(gameView, host));
                }
            }
            catch (Exception exception) { error = exception.Message; Stop(); Repaint(); }
        }
        private static string CurrentSceneKey(Scene scene)
            => AuthStorage.BaseUrl + "\n" + AuthStorage.LastProjectId + "\n" + scene.handle + "\n" + scene.path + "\n" + scene.name;
        private async Task LoadScene(Scene scene, CancellationToken cancel)
        {
            busy = true; status = "現在のシーンの仕様を取得中…"; error = null; Repaint();
            try
            {
                var api = new EditorWorkspaceApi();
                var project = AuthStorage.LastProjectId;
                var endpoint = AuthStorage.BaseUrl;
                var requestedSceneKey = CurrentSceneKey(scene);
                var page = await api.Scenes(project, cancel);
                cancel.ThrowIfCancellationRequested();
                if (page.items == null) throw new InvalidOperationException("Pf returned no scene list.");
                scenes = page.items; bindingKey = SceneOverlayBinding.Key(scene, endpoint, project);
                var saved = manualSceneKey == requestedSceneKey ? manualLayoutId : (bindingKey == null ? null : EditorPrefs.GetString(bindingKey, ""));
                layoutId = SceneOverlayBinding.Resolve(scenes, scene.name, saved);
                if (layoutId == null) throw new InvalidOperationException("The current scene has no unique Pf match. Select its Pf scene in this window.");
                var document = await api.ReviewOverlay(project, layoutId, cancel); cancel.ThrowIfCancellationRequested();
                var next = new TelaReviewOverlay(executable, font, document.telaDocument, host);
                try { next.UpdateViewport(GameViewGeometry.Read(gameView, host)); }
                catch { next.Dispose(); throw; }
                overlay?.Dispose(); overlay = next;
                status = "表示中: " + document.sceneName + "（GameView の表示中に追従）";
            }
            catch (OperationCanceledException) { /* A newer scene or window shutdown owns the next state. */ }
            catch (Exception exception) { if (!cancel.IsCancellationRequested) { error = exception.Message; status = "仕様の取得・表示に失敗しました。"; } }
            finally { if (!cancel.IsCancellationRequested && !disposed) { busy = false; Repaint(); } }
        }
    }
}
