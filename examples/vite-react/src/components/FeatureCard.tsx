interface FeatureCardProps {
  title: string;
  body: string;
}

export default function FeatureCard({ title, body }: FeatureCardProps) {
  return (
    <article className="card">
      <h3 className="card-title">{title}</h3>
      <p className="card-body">{body}</p>
    </article>
  );
}
