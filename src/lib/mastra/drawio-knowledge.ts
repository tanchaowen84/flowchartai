/** Bundled, curated draw.io guidance. No filesystem, embeddings or service. */
import { createSkill } from '@mastra/core/skills';

export const drawioKnowledgeSources = {
  rendererVersion: '32.0.2',
  reviewedAt: '2026-10-13',
  urls: [
    'https://www.drawio.com/docs/reference/diagram-generation/style-reference/',
    'https://github.com/jgraph/drawio-mcp/blob/main/shared/xml-reference.md',
    'https://mastra.ai/docs/skills',
  ],
};

// Authored summaries adapted to OUR graph/field-patch tool, not MCP commands.
export const drawioReferences = {
  'styles.md': `Native shapes and readable labels
Use graph.style as individual string keys, not a semicolon-delimited style string. Example: a decision node can have style {fillColor:'#fff2cc',strokeColor:'#d6b656',fontSize:'14'}. Native boolean values are '0'/'1'; style keys are case-sensitive. Base shape choices already supply their styles. To use another draw.io shape, supply a native shape key, for example shape:'umlLifeline', with suitable dimensions. Use matching perimeter when changing a silhouette (ellipsePerimeter, rhombusPerimeter, rectanglePerimeter).
Labels in graph.label are plain text; the compiler escapes XML. Only addCell XML fragments need escaped attribute text (for example &amp; and &quot;). Current objects may contain rich labels; preserve untouched values. Use whiteSpace:'wrap', readable fontSize and enough width/height for long labels; do not shrink text to fit. Patch style changes are a map of changed keys, so changing fillColor preserves stroke/font/image and other existing keys. Use removeStyleKeys only for keys the request needs removed. Never copy the masked image placeholder from CURRENT DOCUMENT into a patch.`,
  'groups.md': `Departments, containers and nested subprocesses
A department or nested subprocess is a real group vertex, with child cells pointing to its ID via parent. Creation order: outer groups, inner groups, their steps. A background rectangle without parent relationships is not a subprocess. Coordinates on child vertices are relative to their actual parent; edge endpoints use actual cell IDs even across groups. New diagram layout is computed by the server for flowchart/swimlane/architecture/network/mindmap/tree. For coordinate-dependent diagrams, set group dimensions and child coordinates deliberately.
For edits, read the actual parent and geometry from CURRENT DOCUMENT. Place additions below headings and leave room for labels. Moving a node to another group changes its coordinate frame: derive a suitable new relative position. Preserve manual positions and styles outside the requested change. The server can grow affected ancestors and route changed connectors; it does not move all siblings or rebuild the document. If a requested insertion needs more space, include the necessary local geometry changes in the same patch.`,
  'connections.md': `Connections and local structural changes
Conditions belong on edge.label for graph creation and edge value for XML/patches. Use source/target IDs of actual vertices, not labels or invented ports. Flowcharts normally use orthogonalEdgeStyle. Sequence/class links can use straight connections (edgeStyle:'none'); ER uses entityRelationEdgeStyle; mindmaps can use curved:'1'. The server supplies best-effort routing for new diagrams and changed connections.
To insert B between A and C, reconnect the existing A-to-C edge to B and add B-to-C; do not leave the old bypass. When reconnecting an existing edge, set points:[] to discard its previous route. An addCell edge needs edge='1', parent, source, target and <mxGeometry relative='1' as='geometry'/>. A new vertex needs vertex='1', parent and an mxGeometry with x/y/width/height/as='geometry'. Remove dependent edges/children explicitly when deleting their endpoint/parent. All additions, reconnections and requested geometry/style changes go in one complete atomic patch.`,
  'complex-flow.md': `Flow logic examples — resolve symbolic roles to CURRENT DOCUMENT IDs
Before generation, inventory requested roles, actions, decisions, exceptions, loop destinations and synchronization points. For parallel approvals, use shape:parallel for a fork labelled 并行开始 and an AND join labelled 全部审批通过. Fork connects independently to EACH branch; only each branch success connects to the join. Show the meaning in the join label, not only the ID. Example: supervisor review (process) → approved? (decision), finance calculation (process) → amount correct? (decision); only the two positive decision outcomes connect to the AND join. Rejection/correction exits remain separate. The join has one outgoing connection to the next phase. Never connect the branches serially or let an allowed route bypass the join. Separate each process from its result decision. Success and failure leave that result decision on their respective branches. A retry subprocess is a group containing an explicit retry step. Keep the original main refund action and its result decision in the payment department; eligible failure enters the retry subgroup, whose retry step returns to the original main action. Do not put the entire initial attempt inside the retry subgroup.
Example: inserting risk assessment before an existing parallel phase. The old upstream entry now leads to risk assessment; low risk goes to the original fork; high risk goes to manual review; approval resumes at that SAME fork; rejection goes to the requested rejection/end path. Neither allowed route enters the AND join directly. Preserve the parallel branches and their join.
Example: at most three retries means the first attempt plus up to three more attempts. Initialize count=0 BEFORE the original first attempt, outside the returning loop; eligible failure checks count<3, then retry, then increment once, then return without resetting. Exhaustion and non-retryable failure go to manual handling; success is untouched. For a compatible existing loop, retryPolicy {actionId,retryStepId,eligibilityId,manualHandlerId,maxRetries} compiles this local edit. Otherwise use the generic patch. You may combine retryPolicy with other explicitly requested patch operations. Resolve all five IDs from current objects; these examples contain no reusable fixture IDs.`,
  'er.md': `Entity relationships
Use diagramType:'er' with purposeful coordinates; this family keeps your geometry rather than applying flow layout. Represent each entity as a group or process with its name and readable fields (including stated PK/FK). Rows can be child text/process nodes when users need to edit individual fields; do not invent columns or cardinalities. Use parent-relative coordinates for rows. Native relationship edges can use style {edgeStyle:'entityRelationEdgeStyle',startArrow:'ERone',endArrow:'ERmany'} for a stated one-to-many relationship. Reflect optionality only when supplied by the user. Preserve entity/row IDs in later field edits.`,
  'sequence.md': `Sequence and timelines
Use diagramType:'sequence' and explicit coordinates. Participants are aligned horizontally; time progresses downward. A lifeline may use graph shape:'process' with style {shape:'umlLifeline'}, sufficient height and a readable participant label. Add editable message endpoints/activation nodes at successive y coordinates, with the correct parent and source/target IDs; participant-to-participant edges alone do not convey distinct event times. Messages use straight edges; returns can use dashed:'1'. Frames for alternatives/loops are native groups with readable conditions and correctly parented children. Keep event order and separate alternatives. Do not invent timestamps. For timeline, set diagramType:'timeline', use a consistent explicit time axis, and preserve date labels when editing.`,
  'architecture-tree-uml.md': `Architecture, network, trees and UML
For architecture/network, group services by the requested boundary (cloud, cluster, team), use database/actor/native style overrides when meaningful, and label connections with protocols or direction when supplied. Do not invent infrastructure. The server computes node-link layout; labels and IDs remain editable.
For mindmap/tree, preserve parent-child meaning with explicit directed connections. Use diagramType:'mindmap'/'tree'; curved connectors and a subdued color per main branch are optional. Do not add back edges merely to make the graph look connected.
For UML class diagrams, use diagramType:'uml', explicit coordinates and editable class/member groups; use straight native relationships and appropriate stated arrow styles (for example endArrow:'block',endFill:'0' for generalization, startArrow:'diamond' for aggregation). Avoid treating inheritance as a process flow. Broader native styles can be requested through graph.style; a known renderer shape does not by itself establish correct diagram semantics.`,
};

export const drawioSkill = createSkill({
  name: 'drawio-native',
  description:
    'Native draw.io shapes, groups, connectors, diagram families and complex local edits for FlowchartAI.',
  instructions:
    'Use the provided relevant references first. Read another bundled reference only when the request needs it, using skill_read with skillName:drawio-native and path:references/<name>.md. These guides describe our generate_flowchart graph/patch contract. CURRENT DOCUMENT is the only authority for current IDs, parents, geometry, styles and revision. Examples explain patterns; they are not user business rules. No MCP tools, routing:libavoid or postLayout parameters are available. After a successful canvas command, stop.',
  references: drawioReferences,
  metadata: drawioKnowledgeSources,
});

/** Soft context selection only; never restricts tools, families or edits. */
export function relevantDrawioKnowledge(
  diagramType: string,
  requestGoal = ''
): string {
  const topic = `${diagramType} ${requestGoal}`;
  const families = [
    { name: 'er.md', pattern: /\bER\b|entity|实体|数据库关系/i },
    { name: 'sequence.md', pattern: /sequence|时序|timeline|时间线/i },
    {
      name: 'architecture-tree-uml.md',
      pattern: /architecture|network|mindmap|tree|uml|架构|网络|思维导图|类图/i,
    },
    { name: 'complex-flow.md', pattern: /flowchart|swimlane|流程|泳道/i },
  ];
  const family =
    (
      families.find((item) => item.pattern.test(requestGoal)) ||
      families.find((item) => item.pattern.test(diagramType))
    )?.name || 'complex-flow.md';
  const supporting = /style|color|font|颜色|样式|字体/i.test(topic)
    ? 'styles.md'
    : 'groups.md';
  return [family, supporting, 'connections.md']
    .map(
      (name) =>
        `REFERENCE references/${name}:\n${drawioReferences[name as keyof typeof drawioReferences]}`
    )
    .join('\n\n');
}
