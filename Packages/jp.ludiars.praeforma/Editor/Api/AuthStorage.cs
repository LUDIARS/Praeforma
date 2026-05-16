// PASETO token + base URL を EditorPrefs に保管。
// 値は per-machine だが、 EditorPrefs は平文なので「組織内の信頼境界」 前提。
// プロジェクト共有が必要ならユーザーが手動で設定し直す。

using UnityEditor;

namespace Ludiars.Praeforma.Editor
{
    internal static class AuthStorage
    {
        private const string KeyBaseUrl = "Praeforma.BaseUrl";
        private const string KeyToken = "Praeforma.Token";
        private const string KeyProjectId = "Praeforma.LastProjectId";
        private const string KeyLayoutId = "Praeforma.LastLayoutId";

        public static string BaseUrl
        {
            get => EditorPrefs.GetString(KeyBaseUrl, "http://localhost:8889");
            set => EditorPrefs.SetString(KeyBaseUrl, value ?? string.Empty);
        }

        public static string Token
        {
            get => EditorPrefs.GetString(KeyToken, string.Empty);
            set => EditorPrefs.SetString(KeyToken, value ?? string.Empty);
        }

        public static string LastProjectId
        {
            get => EditorPrefs.GetString(KeyProjectId, string.Empty);
            set => EditorPrefs.SetString(KeyProjectId, value ?? string.Empty);
        }

        public static string LastLayoutId
        {
            get => EditorPrefs.GetString(KeyLayoutId, string.Empty);
            set => EditorPrefs.SetString(KeyLayoutId, value ?? string.Empty);
        }

        public static bool HasToken => !string.IsNullOrEmpty(Token);

        public static void Clear()
        {
            EditorPrefs.DeleteKey(KeyToken);
            EditorPrefs.DeleteKey(KeyProjectId);
            EditorPrefs.DeleteKey(KeyLayoutId);
        }
    }
}
