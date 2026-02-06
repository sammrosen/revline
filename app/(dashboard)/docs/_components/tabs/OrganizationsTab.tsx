import { TipBox, WarningBox, CodeBlock } from '../shared';

export function OrganizationsTab() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          <span className="text-emerald-400">Organizations</span> &amp; Access Control
        </h2>
        <p className="text-zinc-300 mb-4">
          Organizations are the top-level container in RevLine. Every workspace belongs to an 
          organization, and users access workspaces through their organization membership.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-sm">
          <div className="space-y-1 text-zinc-400">
            <div><span className="text-emerald-400">Organization</span></div>
            <div className="pl-4">&rarr; <span className="text-blue-400">Members</span> <span className="text-zinc-600">(owner + members with permissions)</span></div>
            <div className="pl-4">&rarr; <span className="text-purple-400">Templates</span> <span className="text-zinc-600">(org-scoped form templates)</span></div>
            <div className="pl-4">&rarr; <span className="text-amber-400">Workspaces</span> <span className="text-zinc-600">(each with its own integrations, leads, workflows)</span></div>
          </div>
        </div>
      </section>

      {/* Members & Permissions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Members &amp; Permissions</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Each organization has an <strong>owner</strong> (full access) and optional <strong>members</strong> with 
          granular permissions. Members are added by email address.
        </p>

        <h3 className="font-medium text-zinc-300 mb-3">Organization Permissions</h3>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">Permission</th>
                <th className="pb-2 font-medium">What It Controls</th>
                <th className="pb-2 font-medium">Owner</th>
                <th className="pb-2 font-medium">Member</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-xs">canManageIntegrations</code></td>
                <td className="py-2 text-zinc-400">Add/edit/delete integrations and secrets</td>
                <td className="py-2 text-green-400">Always</td>
                <td className="py-2 text-zinc-400">Configurable</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-xs">canManageWorkflows</code></td>
                <td className="py-2 text-zinc-400">Create/edit/toggle/delete workflows</td>
                <td className="py-2 text-green-400">Always</td>
                <td className="py-2 text-zinc-400">Configurable</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-xs">canManageTemplates</code></td>
                <td className="py-2 text-zinc-400">Create/edit org templates</td>
                <td className="py-2 text-green-400">Always</td>
                <td className="py-2 text-zinc-400">Configurable</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-xs">canInviteMembers</code></td>
                <td className="py-2 text-zinc-400">Add new members to the org</td>
                <td className="py-2 text-green-400">Always</td>
                <td className="py-2 text-zinc-400">Configurable</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-xs">canCreateWorkspaces</code></td>
                <td className="py-2 text-zinc-400">Create new workspaces in the org</td>
                <td className="py-2 text-green-400">Always</td>
                <td className="py-2 text-zinc-400">Configurable</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2"><code className="text-xs">canAccessAllWorkspaces</code></td>
                <td className="py-2 text-zinc-400">See all workspaces (vs only assigned ones)</td>
                <td className="py-2 text-green-400">Always</td>
                <td className="py-2 text-zinc-400">Configurable</td>
              </tr>
            </tbody>
          </table>
        </div>

        <TipBox title="Managing Members">
          Go to <strong>Settings &rarr; Members</strong> to add, edit permissions, or remove organization 
          members. Only owners and members with <code>canInviteMembers</code> can add new members.
        </TipBox>
      </section>

      {/* Workspace Roles */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Workspace Roles</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Within each workspace, users have a role that determines what they can do. This is 
          separate from (and layered on top of) organization permissions.
        </p>

        <div className="space-y-3">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-amber-900/40 text-amber-400 text-xs font-medium rounded">OWNER</span>
              <span className="text-sm text-zinc-300">Full control. Can delete workspace, manage all settings.</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-blue-900/40 text-blue-400 text-xs font-medium rounded">ADMIN</span>
              <span className="text-sm text-zinc-300">Manage integrations, workflows, leads. Cannot delete workspace.</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-green-900/40 text-green-400 text-xs font-medium rounded">MEMBER</span>
              <span className="text-sm text-zinc-300">View data, run tests, view events. Limited configuration access.</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs font-medium rounded">VIEWER</span>
              <span className="text-sm text-zinc-300">Read-only access. Can view workspace data but cannot modify.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace Assignments */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Workspace Assignments</h2>
        <p className="text-zinc-300 mb-4">
          Members without <code>canAccessAllWorkspaces</code> permission only see workspaces they 
          are explicitly assigned to. This provides granular access control within an organization.
        </p>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-2">How It Works</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>- Owner and members with <code>canAccessAllWorkspaces</code> see all workspaces</li>
            <li>- Other members only see workspaces where they have a <code>WorkspaceAssignment</code></li>
            <li>- Assignments are created by admins or owners</li>
            <li>- Each assignment includes the workspace role (ADMIN, MEMBER, VIEWER)</li>
          </ul>
        </div>
      </section>

      {/* Templates */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Templates</h2>
        <p className="text-zinc-300 mb-4">
          Templates are organization-scoped configurations for forms. They define the copy 
          (headlines, button text, messages) and branding (colors, logos) that forms use.
        </p>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Available Template Types</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <code className="text-purple-400 text-sm shrink-0">booking</code>
                <p className="text-sm text-zinc-400">
                  Copy for the booking form: page headline, description, booking button text, 
                  confirmation messages, eligibility messages, waitlist text.
                </p>
              </div>
              <div className="flex gap-3">
                <code className="text-purple-400 text-sm shrink-0">signup</code>
                <p className="text-sm text-zinc-400">
                  Copy for the signup form: step labels, input placeholders, CTAs, success messages.
                </p>
              </div>
            </div>
          </div>
        </div>

        <TipBox>
          Templates are managed from the <strong>Templates</strong> page in the sidebar. Each template 
          can be enabled or disabled per organization. Workspace forms inherit their copy/branding 
          from the organization template.
        </TipBox>
      </section>

      {/* Custom Domains */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Custom Domains</h2>
        <p className="text-zinc-300 mb-4">
          Workspaces can use a custom domain for their public-facing pages (booking forms, signup 
          flows). This is configured per-workspace in the Settings tab.
        </p>

        <h3 className="font-medium text-zinc-300 mb-3">Setup Flow</h3>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">1</span>
              <div>
                <p className="font-medium text-white">Enter Domain</p>
                <p className="text-sm text-zinc-400">Go to workspace Settings &rarr; Custom Domain and enter your domain (e.g., <code>book.yourbusiness.com</code>)</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">2</span>
              <div>
                <p className="font-medium text-white">Add DNS Record</p>
                <p className="text-sm text-zinc-400">RevLine generates a TXT record. Add it to your DNS provider to prove ownership.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">3</span>
              <div>
                <p className="font-medium text-white">Verify DNS</p>
                <p className="text-sm text-zinc-400">Click &quot;Verify&quot; once the DNS record is propagated (can take up to 48 hours).</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white font-medium shrink-0">4</span>
              <div>
                <p className="font-medium text-white">Point Domain</p>
                <p className="text-sm text-zinc-400">Add a CNAME record pointing your domain to the RevLine server.</p>
              </div>
            </li>
          </ol>
        </div>

        <WarningBox>
          Custom domains require DNS changes that can take time to propagate. If verification fails, 
          wait a few hours and try again. Use a DNS checker tool to confirm the TXT record is visible.
        </WarningBox>
      </section>

      {/* Custom Lead Stages */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Custom Lead Stages</h2>
        <p className="text-zinc-300 mb-4">
          Each workspace can customize its lead pipeline stages. The defaults are CAPTURED, BOOKED, 
          PAID, and DEAD, but you can add, rename, reorder, and color-code stages to match the 
          business flow.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">Default Stages</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-zinc-500"></span>
              <span className="text-zinc-300">CAPTURED</span>
              <span className="text-zinc-600">&mdash; Lead submitted email (always present, cannot be removed)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
              <span className="text-zinc-300">BOOKED</span>
              <span className="text-zinc-600">&mdash; Call or appointment scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-zinc-300">PAID</span>
              <span className="text-zinc-600">&mdash; Payment received</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-zinc-300">DEAD</span>
              <span className="text-zinc-600">&mdash; Inactive or unsubscribed</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h3 className="font-medium text-white mb-3">Customizing Stages</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Go to workspace <strong>Settings</strong> tab</li>
            <li>2. Scroll to <strong>Lead Pipeline Stages</strong></li>
            <li>3. Add new stages, rename labels, or pick colors</li>
            <li>4. Reference custom stage names in <code>revline.update_lead_stage</code> workflow actions</li>
          </ol>
        </div>

        <TipBox>
          Custom stages are stored as JSON on the workspace. Workflow actions reference stage names, 
          so make sure workflow parameters match your custom stage labels exactly.
        </TipBox>
      </section>

      {/* Custom Lead Properties */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Custom Lead Properties</h2>
        <p className="text-zinc-300 mb-4">
          Each workspace can define a schema of custom properties on leads beyond the built-in 
          fields (email, source, stage). This lets you store business-specific data like member 
          barcodes, phone numbers, membership types, or any other lead attribute.
        </p>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">How It Works</h3>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>1. Define a <strong>property schema</strong> on the workspace (up to 25 properties)</li>
            <li>2. Each property has a <strong>key</strong>, <strong>label</strong>, <strong>type</strong>, and <strong>required</strong> flag</li>
            <li>3. Lead data is validated against the schema on create/update</li>
            <li>4. Properties show as columns in the Leads tab</li>
            <li>5. Workflows can set, update, and read properties</li>
          </ol>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">Property Types</h3>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Example</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2"><code>string</code></td>
                  <td className="py-2 text-zinc-400">Free text</td>
                  <td className="py-2 text-zinc-400"><code>&quot;ABC123&quot;</code></td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2"><code>number</code></td>
                  <td className="py-2 text-zinc-400">Numeric value (auto-coerced)</td>
                  <td className="py-2 text-zinc-400"><code>42</code></td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2"><code>boolean</code></td>
                  <td className="py-2 text-zinc-400">True/false</td>
                  <td className="py-2 text-zinc-400"><code>true</code></td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2"><code>email</code></td>
                  <td className="py-2 text-zinc-400">Validated email address</td>
                  <td className="py-2 text-zinc-400"><code>&quot;alt@example.com&quot;</code></td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2"><code>url</code></td>
                  <td className="py-2 text-zinc-400">Validated URL</td>
                  <td className="py-2 text-zinc-400"><code>&quot;https://...&quot;</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">Example Schema</h3>
          <CodeBlock language="json" title="leadPropertySchema">{`[
  { "key": "barcode", "label": "Member Barcode", "type": "string", "required": true },
  { "key": "memberType", "label": "Member Type", "type": "string", "required": false },
  { "key": "sessionBalance", "label": "Session Balance", "type": "number", "required": false }
]`}</CodeBlock>
          <p className="text-xs text-zinc-500 mt-3">
            Property keys must be lowercase alphanumeric with underscores, starting with a letter 
            (e.g., <code>barcode</code>, <code>member_type</code>).
          </p>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <h3 className="font-medium text-white mb-3">Using Properties in Workflows</h3>
          <ul className="text-sm text-zinc-400 space-y-2">
            <li>&bull; <strong>Set on lead creation:</strong> Use <code>revline.create_lead</code> with 
              a <code>properties</code> parameter or <code>captureProperties: true</code> to auto-extract from the trigger payload</li>
            <li>&bull; <strong>Update properties:</strong> Use <code>revline.update_lead_properties</code> to 
              set or merge properties on an existing lead</li>
            <li>&bull; <strong>Template variables:</strong> Access properties in email templates 
              with <code>{`{{lead.barcode}}`}</code>, <code>{`{{lead.memberType}}`}</code>, etc.</li>
            <li>&bull; <strong>Integration mapping:</strong> Map properties to external fields 
              (e.g., MailerLite subscriber fields via the <code>fields</code> parameter on <code>add_to_group</code>)</li>
          </ul>
        </div>

        <WarningBox>
          Once leads have data for a property, that property key cannot be removed from the schema. 
          This prevents data loss. You can still rename the label or change the required flag.
        </WarningBox>
      </section>

      {/* For Developers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">For Developers</h2>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Access Control Code Paths</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <div>
                <code className="text-white">app/_lib/organization-access.ts</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Org-level permission checks: <code>requireOrgAccess()</code>, <code>hasPermission()</code>, 
                  <code>getUserOrgs()</code>. Owners bypass all permission checks.
                </p>
              </div>
              <div>
                <code className="text-white">app/_lib/workspace-access.ts</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Workspace-level role checks. Validates user has required role for the operation.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="font-medium text-white mb-2">Key Patterns</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>- All API routes check org membership before returning data</li>
              <li>- Permission-gated operations verify the specific permission (not just membership)</li>
              <li>- Workspace data never leaks across organizations</li>
              <li>- Owner status is checked via <code>isOwner</code> field, not role</li>
              <li>- Workspace assignments respected when <code>canAccessAllWorkspaces</code> is false</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
