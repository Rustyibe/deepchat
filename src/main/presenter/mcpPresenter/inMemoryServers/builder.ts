import { ArtifactsServer } from './artifactsServer'
import { FileSystemServer } from './filesystem'
import { BochaSearchServer } from './bochaSearchServer'
import { ImageServer } from './imageServer'

export function getInMemoryServer(
  serverName: string,
  args: string[],
  env?: Record<string, string>
) {
  switch (serverName) {
    case 'buildInFileSystem':
      return new FileSystemServer(args)
    case 'Artifacts':
      return new ArtifactsServer()
    case 'bochaSearch':
      return new BochaSearchServer(env)
    case 'imageServer':
      return new ImageServer(args[0], args[1], args[2], args[3], args[4], args[5])
    default:
      throw new Error(`Unknown in-memory server: ${serverName}`)
  }
}
