/**
 * Text Input Section Component
 * テキスト入力セクションコンポーネント
 */
export function TextInputSection({
  textValue,
  onTextChange,
  onLoadSample,
  onResetHighlight,
  onContinue,
  canContinue
}) {
  const sampleText = `Teacher: Today's unit question is "How do we make decisions?"
Yuna: We make decisions every day—what to wear, what to eat, what to watch.
Teacher: Great. What kinds of factors affect our decisions?
Sophy: A big factor for me is my parents' opinions.
Teacher: Often other people influence our choices. What else?
Marcus: Sometimes we want to change or feel better about ourselves.`;

  const handleLoadSample = () => {
    onTextChange(sampleText);
    onLoadSample?.(sampleText);
  };

  return (
    <section className="card card--input">
      <header className="card__header">
        <div>
          <p className="eyebrow">Script</p>
          <h2>読みたい英文を貼り付けるだけ</h2>
        </div>
        <div className="card__actions">
          <button type="button" className="ghost" onClick={handleLoadSample}>
            サンプル
          </button>
          <button type="button" className="ghost" onClick={onResetHighlight}>
            リセット
          </button>
        </div>
      </header>

      <textarea
        id="textInput"
        className="script-input"
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        spellCheck="false"
        placeholder="英文をここにペースト"
      />
      <footer className="card__footer">
        <button type="button" className="primary" disabled={!canContinue} onClick={onContinue}>
          リーダーを開く
        </button>
        <p className="card__note">一度貼り付ければ、あとは声を出すだけです。</p>
      </footer>
    </section>
  );
}
