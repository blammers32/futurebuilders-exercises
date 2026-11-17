import 'katex/dist/katex.min.css'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

// Models mix \( \), \[ \] and <sup> with $ math; remark-math only reads $.
function tidy(text: string) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`)
    .replace(/(\w)<sup>(.*?)<\/sup>/g, (_, base, power) => `$${base}^{${power}}$`)
    .replace(/(\w)<sub>(.*?)<\/sub>/g, (_, base, low) => `$${base}_{${low}}$`)
}

export function Md({ text }: { text: string }) {
  return (
    <div className="cost-md">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {tidy(text)}
      </ReactMarkdown>
    </div>
  )
}
