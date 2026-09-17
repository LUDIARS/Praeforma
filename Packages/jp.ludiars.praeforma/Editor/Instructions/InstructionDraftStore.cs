// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using UnityEditor;
using UnityEngine;

namespace Ludiars.Praeforma.Editor
{
    internal static class InstructionDraftStore
    {
        public static string Key(string endpoint, string projectId)
            => "Praeforma.Instruction." + Hash128.Compute(endpoint.TrimEnd('/') + "\n" + projectId);
        public static InstructionDraft Load(string key)
        {
            var value = SessionState.GetString(key, "");
            return string.IsNullOrEmpty(value) ? new InstructionDraft() : JsonUtility.FromJson<InstructionDraft>(value);
        }
        public static void Save(string key, InstructionDraft draft)
            => SessionState.SetString(key, JsonUtility.ToJson(draft));
    }
}
