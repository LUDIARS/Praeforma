// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;

namespace Ludiars.Praeforma.Editor
{
    [Serializable] internal sealed class EditorSpec
    {
        public string id, projectId, code, title, description, status;
        public int version;
    }
    [Serializable] internal sealed class EditorSpecPage { public EditorSpec[] items; }
    [Serializable] internal sealed class EditorInstructionRequest { public string content, sourceEventId; }
    [Serializable] internal sealed class EditorFragment { public string id, projectId, content, sourceEventId; }
    [Serializable] internal sealed class EditorFragmentResponse { public EditorFragment fragment; public bool replayed; }
}
