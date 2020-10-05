import fetch from 'node-fetch'
import type { GatsbyNode, NodePluginArgs, Node, PluginOptions } from 'gatsby'

export const sourceNodes: GatsbyNode['sourceNodes'] = async (args: NodePluginArgs, options: PluginOptions) => {
  const {
    getNodesByType,
    reporter
  } = args
  const activity = reporter.activityTimer('Fetching related posts')
  activity.start()

  try {
    const posts = getNodesByType(`${options.typePrefix || 'Wp'}Post`)
    const promises = posts.map(async post => {
      await setRelatedPosts(post, options, args)
    })
    await Promise.all(promises)
  } catch (err) {
    reporter.panic("Errore nella creazione di post correlati.", err)
  }
  activity.end()
  return
}

async function setRelatedPosts(post: Node, options: PluginOptions, args: NodePluginArgs) {
  const {
    getNode,
    reporter,
    createNodeId,
    createContentDigest,
    actions: { createNode, createParentChildLink },
  } = args

  const postId = Buffer.from(post.id, 'base64').toString().slice(5)
  const related = await fetchRelatedPosts(options, postId)
    .catch(err => {
      reporter.panic("Errore di fetch", err)
      return {}
    })
  const nodeId = createNodeId(`related-${post.id}`)
  const nodeData = {
    posts: related,
    id: nodeId,
    parent: post.id,
    internal: {
      type: 'RelatedPost',
      contentDigest: createContentDigest(related)
    }
  }

  createNode(nodeData)
  const child = getNode(nodeId)
  createParentChildLink({ parent: post, child: child })
}

function fetchRelatedPosts(options: PluginOptions, postId: string) {
  return fetch(options.url + `/wp-json/yarpp/v1/related/` + postId)
    .then(response => response.json())
    .then((data: any[]) => {
      return data.map(p => {
        return { score: p.score, post___NODE: Buffer.from("post:" + p.id.toString()).toString('base64') }
      })
    })
}
