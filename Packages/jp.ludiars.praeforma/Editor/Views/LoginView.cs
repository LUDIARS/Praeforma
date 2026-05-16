// Login タブ: base URL + PASETO token を EditorPrefs に保存。 接続テスト機能付き。
//
// PASETO token は Cernere の login UI で取得 → コピペで Editor に貼る運用。
// Cernere OAuth flow を Editor に統合する手はあるが v0.1 では手動で十分。

using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor.Views
{
    internal class LoginView
    {
        private readonly PraeformaWindow _win;
        private string _baseUrl;
        private string _token;
        private string _statusMessage = string.Empty;
        private MessageType _statusType = MessageType.None;

        public LoginView(PraeformaWindow win)
        {
            _win = win;
            _baseUrl = AuthStorage.BaseUrl;
            _token = AuthStorage.Token;
        }

        public void OnGUI()
        {
            EditorGUILayout.LabelField("Backend Settings", EditorStyles.boldLabel);
            _baseUrl = EditorGUILayout.TextField("Base URL", _baseUrl);
            EditorGUILayout.LabelField("PASETO Token", EditorStyles.miniLabel);
            _token = EditorGUILayout.TextArea(_token, GUILayout.MinHeight(60));

            EditorGUILayout.Space();
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Save"))
                {
                    AuthStorage.BaseUrl = _baseUrl?.Trim();
                    AuthStorage.Token = _token?.Trim();
                    _statusMessage = "Saved";
                    _statusType = MessageType.Info;
                }
                if (GUILayout.Button("Test Connection"))
                {
                    AuthStorage.BaseUrl = _baseUrl?.Trim();
                    AuthStorage.Token = _token?.Trim();
                    _ = _win.SafeRun(TestConnection);
                }
                if (GUILayout.Button("Clear"))
                {
                    AuthStorage.Clear();
                    _token = string.Empty;
                    _statusMessage = "Cleared";
                    _statusType = MessageType.Info;
                }
            }

            if (!string.IsNullOrEmpty(_statusMessage))
            {
                EditorGUILayout.HelpBox(_statusMessage, _statusType);
            }

            EditorGUILayout.Space();
            EditorGUILayout.HelpBox(
                "Praeforma の Web UI でログイン後、 設定画面から PASETO token をコピーして貼り付けてください。 "
              + "token は EditorPrefs に保存され、 Unity Editor 再起動後も維持されます。",
                MessageType.None);
        }

        private async System.Threading.Tasks.Task TestConnection()
        {
            _statusMessage = "Connecting...";
            _statusType = MessageType.None;
            try
            {
                var res = await PraeformaApi.ListProjects();
                int n = res?.items?.Length ?? 0;
                _statusMessage = $"OK — {n} project(s) accessible";
                _statusType = MessageType.Info;
            }
            catch (PraeformaApi.ApiException ae)
            {
                _statusMessage = $"Failed: HTTP {ae.Status} — {ae.Message}";
                _statusType = MessageType.Error;
            }
            catch (System.Exception e)
            {
                _statusMessage = $"Failed: {e.Message}";
                _statusType = MessageType.Error;
            }
        }
    }
}
