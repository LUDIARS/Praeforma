// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;

namespace Ludiars.Praeforma.Editor
{
    // Immutable delivery snapshot prevents retrying a changed instruction under the same event ID.
    [Serializable] internal sealed class InstructionDraft
    {
        public string text = "", target = "", eventId = "", payload = "", savedId = "";
        public bool Frozen => !string.IsNullOrEmpty(eventId);
        public EditorInstructionRequest Freeze(string newEventId)
        {
            if (!Frozen)
            {
                if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("Enter an instruction.");
                var content = text + (string.IsNullOrEmpty(target) ? "" : "\n\nUnity target (context):\n" + target);
                if (content.Length > 20000) throw new InvalidOperationException("Instruction and target exceed 20,000 characters.");
                if (!Guid.TryParse(newEventId, out _)) throw new InvalidOperationException("Invalid delivery ID.");
                payload = content;
                eventId = newEventId;
            }
            return new EditorInstructionRequest { content = payload, sourceEventId = eventId };
        }
        public void Acknowledge(EditorFragment value, string projectId)
        {
            if (value == null || string.IsNullOrEmpty(value.id) || value.projectId != projectId ||
                value.sourceEventId != eventId || value.content != payload)
                throw new InvalidOperationException("Pf response does not match the saved request; draft retained.");
            savedId = value.id;
        }
    }
}
