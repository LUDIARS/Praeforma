using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Ludiars.Praeforma.Editor;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Ludiars.Praeforma.Tela.Editor
{
    internal static class SceneOverlayBinding
    {
        internal static string Key(Scene scene, string endpoint, string project)
        {
            var guid = AssetDatabase.AssetPathToGUID(scene.path);
            if (string.IsNullOrEmpty(guid)) return null;
            using (var hash = SHA256.Create())
                return "Praeforma.GameView.Scene." + Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(Application.dataPath + "\n" + endpoint + "\n" + project + "\n" + guid)));
        }
        internal static string Resolve(EditorScene[] scenes, string sceneName, string savedId)
        {
            if (!string.IsNullOrEmpty(savedId)) return scenes.Any(scene => scene.id == savedId) ? savedId : null;
            var matches = scenes.Where(scene => string.Equals(scene.name, sceneName, StringComparison.OrdinalIgnoreCase)).ToArray();
            return matches.Length == 1 ? matches[0].id : null;
        }
    }
}
