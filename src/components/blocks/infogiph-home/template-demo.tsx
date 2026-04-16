import type { TemplateDemoKind } from './types';

// Stylized hub-and-spoke / tree previews for each Infogiph template card.
// Palette mirrors my-clone's warm accent colors (#f5c84b, #e63946, #ff6b9d, #ff8a5c).

const WARM = ['#f5c84b', '#e63946', '#ff6b9d', '#ff8a5c', '#c74bb5', '#2e5aef'];

function HubAndSpoke({
  hub,
  spokes,
  hubBg,
  bg,
}: {
  hub: string;
  spokes: string[];
  hubBg: string;
  bg: string;
}) {
  const radius = 70;
  const cx = 100;
  const cy = 100;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4"
      style={{ background: bg }}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full">
        {spokes.map((label, i) => {
          const angle = (i / spokes.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const color = WARM[i % WARM.length];
          return (
            <g key={label}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgba(0,0,0,0.15)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <circle cx={x} cy={y} r={11} fill={color} />
              <text
                x={x}
                y={y + 3.2}
                textAnchor="middle"
                fontSize="6"
                fill="white"
                fontWeight="700"
              >
                {label}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={22} fill={hubBg} />
        <text
          x={cx}
          y={cy + 3.6}
          textAnchor="middle"
          fontSize="8"
          fill="white"
          fontWeight="700"
        >
          {hub}
        </text>
      </svg>
    </div>
  );
}

function Tree() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#faeee0]">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        {[
          [100, 52, 60, 108],
          [100, 52, 100, 108],
          [100, 52, 140, 108],
          [100, 130, 75, 170],
          [100, 130, 125, 170],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="1.5"
          />
        ))}

        <rect x="78" y="32" width="44" height="22" rx="4" fill="#0f2a3e" />
        <text
          x="100"
          y="46"
          textAnchor="middle"
          fontSize="9"
          fill="#f5c84b"
          fontWeight="700"
        >
          CEO
        </text>

        <rect x="40" y="108" width="40" height="20" rx="4" fill="#ff6b9d" />
        <text
          x="60"
          y="121"
          textAnchor="middle"
          fontSize="8"
          fill="white"
          fontWeight="700"
        >
          CMO
        </text>
        <rect x="80" y="108" width="40" height="20" rx="4" fill="#e63946" />
        <text
          x="100"
          y="121"
          textAnchor="middle"
          fontSize="8"
          fill="white"
          fontWeight="700"
        >
          CTO
        </text>
        <rect x="120" y="108" width="40" height="20" rx="4" fill="#ff8a5c" />
        <text
          x="140"
          y="121"
          textAnchor="middle"
          fontSize="8"
          fill="white"
          fontWeight="700"
        >
          COO
        </text>

        <rect x="55" y="170" width="40" height="20" rx="4" fill="#f5c84b" />
        <text
          x="75"
          y="183"
          textAnchor="middle"
          fontSize="7"
          fill="#0f2a3e"
          fontWeight="700"
        >
          Eng
        </text>
        <rect x="105" y="170" width="40" height="20" rx="4" fill="#f5c84b" />
        <text
          x="125"
          y="183"
          textAnchor="middle"
          fontSize="7"
          fill="#0f2a3e"
          fontWeight="700"
        >
          Eng
        </text>
      </svg>
    </div>
  );
}

export function TemplateDemo({ demo }: { demo: TemplateDemoKind }) {
  switch (demo) {
    case 'chatbot':
      return (
        <HubAndSpoke
          hub="Bot"
          hubBg="#0f2a3e"
          bg="#fff4e0"
          spokes={['NLP', 'KB', 'Web', 'API', 'WA', 'CRM']}
        />
      );
    case 'saas':
      return (
        <HubAndSpoke
          hub="API"
          hubBg="#c74bb5"
          bg="#faeee0"
          spokes={['Auth', 'DB', 'Bill', 'UI', 'Mail', 'S3']}
        />
      );
    case 'ecommerce':
      return (
        <HubAndSpoke
          hub="Shop"
          hubBg="#e63946"
          bg="#fff4e0"
          spokes={['Cart', 'Pay', 'Ship', 'Inv', 'Mail', 'An']}
        />
      );
    case 'data-pipeline':
      return (
        <HubAndSpoke
          hub="Lake"
          hubBg="#0f2a3e"
          bg="#faeee0"
          spokes={['Ing', 'ETL', 'ML', 'Dash', 'API', 'Alt']}
        />
      );
    case 'social':
      return (
        <HubAndSpoke
          hub="Feed"
          hubBg="#ff6b9d"
          bg="#fff4e0"
          spokes={['User', 'Msg', 'CDN', 'Srch', 'Note', 'An']}
        />
      );
    case 'ai-agent':
      return (
        <HubAndSpoke
          hub="Agent"
          hubBg="#c74bb5"
          bg="#fff4e0"
          spokes={['LLM', 'Vec', 'Tool', 'Mem', 'Web', 'API']}
        />
      );
    case 'org-chart':
    default:
      return <Tree />;
  }
}
