import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js'
import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import { presenter } from '@/presenter'
import { ChatMessage, ChatMessageContent } from '../../llmProviderPresenter/baseProvider' // Corrected Import Path
import { getModelConfig } from '@/presenter/llmProviderPresenter/modelConfigs'
import { R2 } from 'node-cloudflare-r2'
// import { GenerateCompletionOptions } from '@/presenter/llmProviderPresenter' // Assuming this path and type exist - using any for now

// --- Zod Schemas for Tool Arguments ---

const ReadImageBase64ArgsSchema = z.object({
  path: z.string().describe('Path to the image file.')
})

const UploadImageArgsSchema = z.object({
  path: z.string().describe('Path to the image file to upload.')
})

const ReadMultipleImagesBase64ArgsSchema = z.object({
  paths: z.array(z.string()).describe('List of paths to the image files.')
})

const UploadMultipleImagesArgsSchema = z.object({
  paths: z.array(z.string()).describe('List of paths to the image files to upload.')
})

const QueryImageWithPromptArgsSchema = z.object({
  path: z.string().describe('Path to the image file to query.'),
  prompt: z
    .string()
    .describe('The prompt to use when querying the image with the multimodal model.')
})

const DescribeImageArgsSchema = z.object({
  path: z.string().describe('Path to the image file to do simple describe.')
})

const OcrImageArgsSchema = z.object({
  path: z.string().describe('Path to the image file for OCR text extraction.')
})

const ToolInputSchema = ToolSchema.shape.inputSchema
type ToolInput = z.infer<typeof ToolInputSchema>

// --- Image Server Implementation ---

export class ImageServer {
  private server: Server
  private provider: string
  private model: string
  private r2Client: R2 | null = null
  private bucketName: string | null = null
  private publicUrlBase: string | undefined

  constructor(
    provider: string,
    model: string,
    accountId?: string,
    accessKeyId?: string,
    secretAccessKey?: string,
    endpoint?: string,
    bucketName?: string,
    publicUrlBase?: string
  ) {
    this.provider = provider
    this.model = model
    this.server = new Server(
      {
        name: 'image-processing-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    this.setupRequestHandlers()
    console.log('accountId', accountId)
    console.log('accessKeyId', accessKeyId)
    console.log('secretAccessKey', secretAccessKey)
    console.log('endpoint', endpoint)
    console.log('bucketName', bucketName)
    console.log('publicUrlBase', publicUrlBase)
    if (accountId && accessKeyId && secretAccessKey) {
      this.bucketName = bucketName ?? 'temp'
      this.initializeR2Client(accountId, accessKeyId, secretAccessKey, endpoint)
    }
    this.publicUrlBase = publicUrlBase
  }

  private initializeR2Client(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    endpoint?: string
  ): void {
    try {
      this.r2Client = new R2(
        {
          accountId: accountId,
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey
        },
        {
          endpoint: endpoint
        }
      )

      console.log('R2 client initialized successfully')
    } catch (error) {
      console.error('Failed to initialize R2 client:', error)
      this.r2Client = null
    }
  }

  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  private async uploadImageToService(filePath: string, fileBuffer: Buffer): Promise<string> {
    if (!this.r2Client) {
      throw new Error('R2 client not initialized. Check your Cloudflare R2 configuration.')
    }

    try {
      const fileName = path.basename(filePath)
      // Create a unique file key to avoid overwriting existing files
      const fileKey = `images/${Date.now()}-${fileName}`

      // Get file mime type based on extension (or default to jpeg)
      const fileExt = path.extname(fileName).toLowerCase()
      const mimeType = this.getMimeType(fileExt)

      // Upload the file to R2
      const uploadResult = await this.r2Client
        .bucket(this.bucketName ?? 'temp')
        .upload(fileBuffer, fileKey, {}, mimeType)

      console.log(`Uploaded ${filePath} to R2 with key: ${fileKey}`, uploadResult.uri)

      // // If R2 provides a direct URI, use it
      // if (uploadResult.uri) {
      //   return uploadResult.uri
      // }

      // Otherwise construct a public URL using the Cloudflare R2 public endpoint pattern
      // This assumes you've configured public access to your R2 bucket
      // Format: https://<accountid>.r2.dev/<bucketname>/<objectkey>
      // Or if using Cloudflare Workers as proxy: https://<your-worker-subdomain>.workers.dev/<objectkey>

      if (this.publicUrlBase) {
        console.log(`${this.publicUrlBase.replace(/\/+$/, '')}/${fileKey}`)
        return `${this.publicUrlBase.replace(/\/+$/, '')}/${fileKey}`
      }

      throw new Error(
        'No public URL configuration available for R2. Please set R2_PUBLIC_URL environment variable or configure a publicUrlBase.'
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`R2 upload error: ${errorMessage}`)
      throw new Error(`Failed to upload image to R2: ${errorMessage}`)
    }
  }

  // Helper method to determine mime type from file extension
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp'
    }

    return mimeTypes[extension] || 'application/octet-stream'
  }

  // --- Placeholder for Multimodal Model Interaction ---
  private async queryImageWithModel(
    filePath: string,
    fileBuffer: Buffer,
    prompt: string
  ): Promise<string> {
    // TODO: Implement actual API call to a multimodal model (e.g., GPT-4o, Gemini)
    console.log(
      `Querying ${filePath} (size: ${fileBuffer.length} bytes) using ${this.provider}/${this.model} with prompt: "${prompt}"...`
    )

    // Construct the messages array for the multimodal model
    const base64Image = fileBuffer.toString('base64')
    // TODO: Dynamically determine mime type if possible, otherwise assume common type like jpeg
    const dataUrl = `data:image/jpeg;base64,${base64Image}`

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt }, // Use the provided prompt
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          }
        ] as ChatMessageContent[] // Type assertion might be needed depending on ChatMessageContent definition
      }
    ]

    const modelConfig = getModelConfig(this.model)

    try {
      const response = await presenter.llmproviderPresenter.generateCompletionStandalone(
        this.provider,
        messages,
        this.model,
        modelConfig?.temperature || 0.6,
        modelConfig?.maxTokens || 1000
      )
      console.log(`Model response received: ${response}`)
      return response ?? 'No response generated.' // Handle potential null/undefined response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Error querying image: ${errorMessage}`)
      // Re-throw or return an error message
      throw new Error(`Failed to query image: ${errorMessage}`)
      // Or return `Error generating response: ${errorMessage}`;
    }
  }

  private async ocrImageWithModel(filePath: string, fileBuffer: Buffer): Promise<string> {
    // TODO: Implement actual API call to an OCR service or a multimodal model capable of OCR
    console.log(
      `Requesting OCR for ${filePath} (size: ${fileBuffer.length} bytes) using ${this.provider}/${this.model}...`
    )

    // Construct the messages array for the multimodal model
    const base64Image = fileBuffer.toString('base64')
    // TODO: Dynamically determine mime type if possible
    const dataUrl = `data:image/jpeg;base64,${base64Image}`

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Perform OCR on this image and return the extracted text.' },
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          }
        ] as ChatMessageContent[] // Type assertion
      }
    ]

    console.log(messages)

    const modelConfig = getModelConfig(this.model)

    try {
      const ocrText = await presenter.llmproviderPresenter.generateCompletionStandalone(
        this.provider,
        messages,
        this.model,
        modelConfig?.temperature || 0.6,
        modelConfig?.maxTokens || 1000
      )
      console.log(`OCR text received: ${ocrText}`)
      return ocrText ?? 'No text extracted.' // Handle potential null/undefined response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Error performing OCR: ${errorMessage}`)
      // Re-throw or return an error message
      throw new Error(`Failed to perform OCR: ${errorMessage}`)
      // Or return `Error performing OCR: ${errorMessage}`;
    }
  }

  // --- Request Handlers ---

  private setupRequestHandlers(): void {
    // List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_image_base64',
            description:
              'Reads an image file from the specified path and returns its base64 encoded content.',
            inputSchema: zodToJsonSchema(ReadImageBase64ArgsSchema) as ToolInput
          },
          {
            name: 'upload_image',
            description:
              'Uploads an image file from the specified path to a hosting service and returns the public URL.',
            inputSchema: zodToJsonSchema(UploadImageArgsSchema) as ToolInput
          },
          {
            name: 'read_multiple_images_base64',
            description:
              'Reads multiple image files from the specified paths and returns their base64 encoded content.',
            inputSchema: zodToJsonSchema(ReadMultipleImagesBase64ArgsSchema) as ToolInput
          },
          {
            name: 'upload_multiple_images',
            description:
              'Uploads multiple image files from the specified paths to a hosting service and returns their public URLs.',
            inputSchema: zodToJsonSchema(UploadMultipleImagesArgsSchema) as ToolInput
          },
          {
            name: 'describe_image',
            description:
              'Uses a multimodal model to simply describe the image at the specified path.',
            inputSchema: zodToJsonSchema(DescribeImageArgsSchema) as ToolInput
          },
          {
            name: 'query_image_with_prompt',
            description:
              'Uses a multimodal model to answer a query (prompt) about the image at the specified path.',
            inputSchema: zodToJsonSchema(QueryImageWithPromptArgsSchema) as ToolInput
          },
          {
            name: 'ocr_image',
            description:
              'Performs Optical Character Recognition (OCR) on the image at the specified path and returns the extracted text.',
            inputSchema: zodToJsonSchema(OcrImageArgsSchema) as ToolInput
          }
        ]
      }
    })

    // Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'read_image_base64': {
            const parsed = ReadImageBase64ArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary (similar to FileSystemServer)
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const base64Content = fileBuffer.toString('base64')
            // Determine mime type (optional but good practice)
            // const mimeType = lookup(filePath) || 'application/octet-stream';
            // const dataUri = `data:${mimeType};base64,${base64Content}`;
            return {
              content: [{ type: 'text', text: base64Content }] // Or return dataUri
            }
          }

          case 'upload_image': {
            const parsed = UploadImageArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const imageUrl = await this.uploadImageToService(filePath, fileBuffer)
            return {
              content: [{ type: 'text', text: imageUrl }]
            }
          }

          case 'read_multiple_images_base64': {
            const parsed = ReadMultipleImagesBase64ArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            const results = await Promise.allSettled(
              parsed.data.paths.map(async (filePath: string) => {
                try {
                  // TODO: Implement path validation if necessary
                  const fileBuffer = await fs.readFile(filePath)
                  return {
                    path: filePath,
                    base64: fileBuffer.toString('base64'),
                    status: 'fulfilled'
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  // Ensure the structure includes path and error for rejected promises
                  return Promise.reject({ path: filePath, error: errorMessage })
                }
              })
            )

            // Format output: [{path: string, base64?: string, error?: string}]
            const formattedResults = results.map((result) => {
              if (result.status === 'fulfilled') {
                return { path: result.value.path, base64: result.value.base64 }
              } else {
                // Access reason directly as it contains the rejected structure
                return { path: result.reason.path, error: result.reason.error }
              }
            })

            return {
              content: [{ type: 'text', text: JSON.stringify(formattedResults, null, 2) }]
            }
          }

          case 'upload_multiple_images': {
            const parsed = UploadMultipleImagesArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }

            const results = await Promise.allSettled(
              parsed.data.paths.map(async (filePath: string) => {
                try {
                  // TODO: Implement path validation if necessary
                  const fileBuffer = await fs.readFile(filePath)
                  const url = await this.uploadImageToService(filePath, fileBuffer)
                  return { path: filePath, url: url, status: 'fulfilled' }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  // Ensure the structure includes path and error for rejected promises
                  return Promise.reject({ path: filePath, error: errorMessage })
                }
              })
            )

            // Format output: [{path: string, url?: string, error?: string}]
            const formattedResults = results.map((result) => {
              if (result.status === 'fulfilled') {
                return { path: result.value.path, url: result.value.url }
              } else {
                // Access reason directly as it contains the rejected structure
                return { path: result.reason.path, error: result.reason.error }
              }
            })

            return {
              content: [{ type: 'text', text: JSON.stringify(formattedResults, null, 2) }]
            }
          }

          case 'describe_image': {
            const parsed = DescribeImageArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const description = await this.queryImageWithModel(
              filePath,
              fileBuffer,
              'Describe this image.'
            )
            return {
              content: [{ type: 'text', text: description }]
            }
          }

          case 'query_image_with_prompt': {
            const parsed = QueryImageWithPromptArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const prompt = parsed.data.prompt // Get the prompt
            const fileBuffer = await fs.readFile(filePath)
            // Call the renamed function with the prompt
            const response = await this.queryImageWithModel(filePath, fileBuffer, prompt)
            return {
              content: [{ type: 'text', text: response }]
            }
          }

          case 'ocr_image': {
            const parsed = OcrImageArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const ocrText = await this.ocrImageWithModel(filePath, fileBuffer)
            return {
              content: [{ type: 'text', text: ocrText }]
            }
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        // Consider logging the error server-side
        console.error(`Error processing tool call: ${errorMessage}`)
        // Ensure the error response structure matches expected format
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true // Indicate this is an error response
        }
      }
    })
  }
}

// --- Usage Example (similar to FileSystemServer) ---
// import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/transport/node';
//
// const imageServer = new ImageServer(
//   'your-llm-provider',
//   'your-multimodal-model',
//   'your-cloudflare-account-id',  // R2配置
//   'your-r2-access-key-id',
//   'your-r2-secret-access-key',
//   'https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com', // R2端点
//   'your-bucket-name',
//   'https://your-public-endpoint.com' // 公开访问URL前缀，例如Workers URL或自定义域名
// );
// // await imageServer.initialize(); // If initialization is added
//
// // Example using WebSocket transport
// const transport = new WebSocketServerTransport({ port: 8081 }); // Choose a different port
// imageServer.startServer(transport);
// console.log('ImageServer started on port 8081');

// You would need a client to connect to this server and call the tools.
