import { TipBox, CodeBlock } from '../shared';

export function ManyChatTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-blue-400">ManyChat</span> Integration
        </h2>
        <p className="text-zinc-300 mb-4">
          ManyChat is primarily a <strong>traffic driver</strong> - it captures interest from Instagram 
          comments and DMs, then directs users to landing pages. RevLine doesn&apos;t need deep 
          integration because ManyChat handles the Instagram side.
        </p>
        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
          <p className="text-sm text-amber-200">
            <strong>Note:</strong> ManyChat is mostly set up in ManyChat itself, not RevLine. 
            This page covers how ManyChat fits into the overall flow.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 font-medium shrink-0">1</span>
              <div>
                <p className="font-medium text-white">User Comments on Instagram Post</p>
                <p className="text-zinc-400">Trigger word like &quot;INFO&quot; or &quot;LINK&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 font-medium shrink-0">2</span>
              <div>
                <p className="font-medium text-white">ManyChat Sends Auto-DM</p>
                <p className="text-zinc-400">Contains link to landing page with UTM params</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 font-medium shrink-0">3</span>
              <div>
                <p className="font-medium text-white">User Clicks Link</p>
                <p className="text-zinc-400">Goes to landing page</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-900/50 text-green-400 font-medium shrink-0">4</span>
              <div>
                <p className="font-medium text-white">User Submits Email</p>
                <p className="text-zinc-400">RevLine captures lead with UTM source tracking</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>Instagram Business Account</strong> - Required for automation</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>ManyChat Pro</strong> ($15-25/month) - Required for Instagram automation</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>Facebook Page</strong> - Instagram must be connected to a Facebook page</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-500">•</span>
              <span><strong>Landing Page URL</strong> - Where to send traffic</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ManyChat Setup */}
      <section>
        <h2 className="text-xl font-semibold mb-4">ManyChat Setup</h2>
        
        <div className="space-y-6">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-3">1. Connect Instagram</h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li>1. Go to ManyChat → Settings → Connect Channels</li>
              <li>2. Connect Instagram account</li>
              <li>3. Authorize permissions (messages, comments)</li>
            </ol>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-3">2. Create Comment Automation</h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li>1. Go to Automation → Instagram → Comments</li>
              <li>2. Click &quot;+ New Trigger&quot;</li>
              <li>3. Choose &quot;Comment contains keyword&quot;</li>
              <li>4. Add keywords: &quot;INFO&quot;, &quot;LINK&quot;, &quot;YES&quot;, etc.</li>
              <li>5. Choose which posts to apply to (all or specific)</li>
            </ol>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-3">3. Set Up Auto-Reply DM</h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li>1. In the automation flow, add &quot;Send DM&quot; action</li>
              <li>2. Write message with landing page link</li>
              <li>3. Include UTM parameters for tracking</li>
            </ol>
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-2">Example DM message:</p>
              <CodeBlock>{`Hey! 👋 Here's the link you asked for:

https://yourdomain.com/client-page?utm_source=manychat&utm_medium=instagram&utm_campaign=comment

Let me know if you have any questions!`}</CodeBlock>
            </div>
          </div>
        </div>
      </section>

      {/* UTM Parameters */}
      <section>
        <h2 className="text-xl font-semibold mb-4">UTM Parameters</h2>
        <p className="text-zinc-300 mb-4">
          Use UTM parameters to track ManyChat traffic in RevLine events.
        </p>

        <CodeBlock title="Recommended UTM Structure">{`https://yourdomain.com/landing-page
  ?utm_source=manychat
  &utm_medium=instagram
  &utm_campaign=comment_automation
  &utm_content=reel_123`}</CodeBlock>

        <div className="mt-4 overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Parameter</th>
                <th className="pb-2 font-medium">Recommended Value</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-white">utm_source</code></td>
                <td className="py-2 text-zinc-400">manychat</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-white">utm_medium</code></td>
                <td className="py-2 text-zinc-400">instagram</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-white">utm_campaign</code></td>
                <td className="py-2 text-zinc-400">comment_automation, story_reply, etc.</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-white">utm_content</code></td>
                <td className="py-2 text-zinc-400">Specific post or reel identifier</td>
              </tr>
            </tbody>
          </table>
        </div>

        <TipBox title="Tracking in RevLine">
          When leads submit their email, RevLine captures the UTM parameters. 
          You can see the source in the Events log and filter by source in the Leads view.
        </TipBox>
      </section>

      {/* RevLine Integration */}
      <section>
        <h2 className="text-xl font-semibold mb-4">RevLine Integration (Optional)</h2>
        <p className="text-zinc-300 mb-4">
          You can add ManyChat as an integration in RevLine, but it&apos;s mostly for tracking 
          purposes. The workflow actions are not commonly used.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">Available Actions</h3>
          <ul className="text-sm text-zinc-400 space-y-2">
            <li>
              <code className="text-white">manychat.trigger_flow</code>
              <span className="text-zinc-500"> — Trigger a ManyChat flow (requires API setup)</span>
            </li>
            <li>
              <code className="text-white">manychat.add_tag</code>
              <span className="text-zinc-500"> — Add tag to ManyChat subscriber</span>
            </li>
          </ul>
          <p className="text-xs text-zinc-500 mt-3">
            These require the ManyChat API Key and are useful for advanced automations 
            like sending follow-up DMs based on RevLine events.
          </p>
        </div>

        <TipBox>
          For most clients, you don&apos;t need to add ManyChat as an integration in RevLine. 
          Just set up the comment automation in ManyChat with UTM-tracked links.
        </TipBox>
      </section>

      {/* Best Practices */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Best Practices</h2>
        <div className="space-y-3">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Use Simple Trigger Words</h3>
            <p className="text-sm text-zinc-400">
              &quot;INFO&quot;, &quot;LINK&quot;, &quot;YES&quot;, &quot;SEND&quot; work well. Avoid complex phrases.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Reply Quickly</h3>
            <p className="text-sm text-zinc-400">
              ManyChat sends DMs instantly. The faster someone gets the link, the more likely they convert.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Keep DMs Short</h3>
            <p className="text-sm text-zinc-400">
              One link, brief context. Don&apos;t overwhelm with information.
            </p>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-1">Test Before Going Live</h3>
            <p className="text-sm text-zinc-400">
              Comment on a test post yourself to verify the automation works end-to-end.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
