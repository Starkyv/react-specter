import { useState } from 'react';

export default function PromptBox() {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');

  const handleGenerate = () => {
    if (prompt.trim()) {
      console.log('Generating with prompt:', prompt);
    }
  };

  return (
    <div className="prompt-box-wrapper">
      <div className="prompt-box-header">
        <div className="prompt-box-header-content">
          <span className="prompt-box-icon">✦</span>
          <span className="prompt-box-stat">Daily more than 10,000+ Images Generated</span>
        </div>
        <span className="prompt-box-powered">Powered by GPT-4o</span>
      </div>

      <div className="prompt-box-container">
        <input
          type="text"
          className="prompt-box-input"
          placeholder="Type a prompt and let AI turn it into an image..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="prompt-box-controls">
          <button className="prompt-box-control-btn">Styles</button>
          <button className="prompt-box-control-btn">🎨</button>
          <div className="prompt-box-ratio-selector">
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              className="prompt-box-ratio"
            >
              <option>1:1</option>
              <option>16:9</option>
              <option>9:16</option>
              <option>4:3</option>
            </select>
          </div>
          <button className="prompt-box-control-btn">🎤</button>
          <button
            className="prompt-box-generate-btn"
            onClick={handleGenerate}
          >
            ✦ Generate
          </button>
        </div>
      </div>
    </div>
  );
}
