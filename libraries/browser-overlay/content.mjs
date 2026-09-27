export function node(tag, text) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  return result;
}

export function isLongBody(text) { return Array.from(text).length > 280 || text.split(/\r?\n/).length > 5; }

/** The full body stays in the document; summaries never claim that a shortened body is complete. */
export function specification(title, body, metadata = '') {
  const article = node('article');
  article.append(node('h3', title));
  if (metadata) article.append(node('p', metadata));
  if (isLongBody(body)) {
    const disclosure = node('details');
    disclosure.append(node('summary', '本文を開く'), node('p', body));
    article.append(disclosure);
  } else article.append(node('p', body || '本文は未記入です。'));
  return article;
}

export function showSpecifications(container, snapshot, scenario) {
  if (scenario) container.append(specification(`${scenario.name} r${scenario.revision}`,
    `ユーザー体験: ${scenario.experience || '未記入'}\n${scenario.goal}\n${scenario.visualDirection || ''}\n成功条件: ${scenario.successOutcome}`));
  if (!snapshot.specs.length) container.append(node('p', '関連する仕様は未登録です。'));
  snapshot.specs.forEach(spec => container.append(specification(`${spec.code} ${spec.title}`, spec.description ?? '', `仕様: ${spec.status} / v${spec.version}`)));
}
