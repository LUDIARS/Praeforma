// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;
using NUnit.Framework;

namespace Ludiars.Praeforma.Editor
{
    public sealed class InstructionDraftTests
    {
        [Test] public void UnknownDeliveryRetriesOriginalBytes()
        {
            var draft = new InstructionDraft { text = "Change the label", target = "object-1" };
            var first = draft.Freeze(Guid.NewGuid().ToString());
            draft.text = "Changed after sending";
            var retry = draft.Freeze(Guid.NewGuid().ToString());
            Assert.AreEqual(first.content, retry.content);
            Assert.AreEqual(first.sourceEventId, retry.sourceEventId);
            Assert.That(retry.content, Does.Contain("object-1"));
        }
        [Test] public void ForeignResponseCannotAcknowledgeDraft()
        {
            var draft = new InstructionDraft { text = "request" };
            var body = draft.Freeze(Guid.NewGuid().ToString());
            var fragment = new EditorFragment { id = "fragment", projectId = "other", content = body.content, sourceEventId = body.sourceEventId };
            Assert.Throws<InvalidOperationException>(() => draft.Acknowledge(fragment, "selected"));
            Assert.IsEmpty(draft.savedId);
            fragment.projectId = "selected";
            draft.Acknowledge(fragment, "selected");
            Assert.AreEqual("fragment", draft.savedId);
        }
        [TestCase("")] [TestCase("   ")]
        public void EmptyInputDoesNotFreeze(string text)
        {
            var draft = new InstructionDraft { text = text };
            Assert.Throws<InvalidOperationException>(() => draft.Freeze(Guid.NewGuid().ToString()));
            Assert.IsFalse(draft.Frozen);
        }
        [Test] public void LocalModeNeverUsesRemoteEndpointOrStoredToken()
        {
            Assert.Throws<InvalidOperationException>(() => new EditorEndpoint("https://example.com", "secret", true));
            Assert.IsEmpty(new EditorEndpoint("http://127.0.0.1:8889", "secret", true).Token);
            Assert.Throws<InvalidOperationException>(() => new EditorEndpoint("https://example.com", "", false));
        }
    }
}
