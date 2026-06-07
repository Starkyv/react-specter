import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const metrics = [
    {
      title: 'Active Users',
      value: '1,234',
      change: '+12%',
      positive: true,
      color: '#4f46e5',
    },
    {
      title: 'Total Requests',
      value: '45.2K',
      change: '+8.5%',
      positive: true,
      color: '#8b5cf6',
    },
    {
      title: 'Avg Response Time',
      value: '125ms',
      change: '-5%',
      positive: true,
      color: '#f97316',
    },
  ];

  const chartData = [
    { name: 'Jan', users: 1000, requests: 4000, time: 150 },
    { name: 'Feb', users: 1100, requests: 4500, time: 140 },
    { name: 'Mar', users: 1150, requests: 4200, time: 135 },
    { name: 'Apr', users: 1200, requests: 4800, time: 130 },
    { name: 'May', users: 1234, requests: 5200, time: 125 },
  ];

  return (
    <section className="dashboard">
      <h2 className="dashboard-title">Metrics</h2>
      <div className="dashboard-grid">
        {metrics.map((metric) => (
          <div key={metric.title} className="metric-card" style={{ '--accent-color': metric.color } as React.CSSProperties}>
            <div className="metric-header">
              <h3 className="metric-title">{metric.title}</h3>
              <span className={`metric-change ${metric.positive ? 'positive' : 'negative'}`}>
                {metric.change}
              </span>
            </div>
            <div className="metric-value">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-charts">
        <div className="chart-container">
          <h3 className="chart-title">Users & Requests</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="users" fill="#4f46e5" name="Users" />
              <Bar dataKey="requests" fill="#8b5cf6" name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3 className="chart-title">Response Time Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="time" stroke="#f97316" strokeWidth={2} name="Response Time (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
