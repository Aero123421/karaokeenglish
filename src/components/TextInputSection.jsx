/**
 * Text Input Section Component
 * テキスト入力セクションコンポーネント
 */
export function TextInputSection({
  textValue,
  onTextChange,
  onLoadSample,
  onResetHighlight
}) {
  const sampleText = `Teacher: Today's unit question is "How do we make decisions?"
Yuna: We make decisions every day—what to wear, what to eat, what to watch.
Teacher: Great. What kinds of factors affect our decisions?
Sophy: A big factor for me is my parents' opinions.
Teacher: Often other people influence our choices. What else?
Marcus: Sometimes we want to change or feel better about ourselves.`;

  const handleLoadSample = () => {
    onTextChange(sampleText);
    onLoadSample();
  };

  return (
    <section className="card card--input">
      <div className="head">
        <h2>テキスト（スクリプトを貼り付け）</h2>
        <div className="controls">
          <button onClick={handleLoadSample}>サンプル</button>
          <button onClick={onResetHighlight}>ハイライトをリセット</button>
        </div>
      </div>
      <div className="body">
        <textarea
          id="textInput"
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          spellCheck="false"
          placeholder="ここに英文スクリプトを貼り付けてください"
        />
        <div className="hint">
          単語単位で分割し、発話に応じて <b>現在の単語</b> と <b>正しく読めた単語（緑）</b>／<b>聞き取りにくかった単語（赤）</b> を表示します。任意の単語をタップするとその位置から再開できます。
        </div>
      </div>
    </section>
  );
}
