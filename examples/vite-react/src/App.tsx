import Counter from './components/Counter';
import FeatureCard from './components/FeatureCard';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>react-specter playground</h1>
        <nav className="nav">
          <a href="#features">Features</a>
          <a href="#counter">Counter</a>
        </nav>
      </header>

      <main>
        <section id="features" className="features">
          {/* FeatureCard renders three times from one call site — clicking one
              should trigger the "just this instance, or everywhere?" prompt. */}
          {[
            { title: 'Inspect', body: 'Hover any element to see its source file and line.' },
            { title: 'Describe', body: 'Type the change you want in plain language.' },
            { title: 'Apply', body: 'Your agent edits the real source file for you.' },
          ].map(f => (
            <FeatureCard key={f.title} title={f.title} body={f.body} />
          ))}
        </section>

        <section id="counter" className="counter-section">
          <h2>A stateful component</h2>
          <Counter />
        </section>
      </main>

      <footer className="footer">
        <small>Press ⌘⇧E (Ctrl⇧E) or click the ✦ button to start inspecting.</small>
      </footer>
    </div>
  );
}
