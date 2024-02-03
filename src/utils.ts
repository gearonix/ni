import os from 'node:os'
import { dirname, join } from 'node:path'
import { existsSync, promises as fs } from 'node:fs'
import type { Buffer } from 'node:buffer'
import process from 'node:process'
import which from 'which'
import c from 'kleur'

export const CLI_TEMP_DIR = join(os.tmpdir(), 'antfu-ni')

export function remove<T>(arr: T[], v: T) {
  const index = arr.indexOf(v)
  if (index >= 0)
    arr.splice(index, 1)

  return arr
}

export function exclude<T>(arr: T[], ...v: T[]) {
  return arr.slice().filter(item => !v.includes(item))
}

export function cmdExists(cmd: string) {
  return which.sync(cmd, { nothrow: true }) !== null
}

export function getVoltaPrefix(): string {
  // https://blog.volta.sh/2020/11/25/command-spotlight-volta-run/
  const VOLTA_PREFIX = 'volta run'
  const hasVoltaCommand = cmdExists('volta')
  return hasVoltaCommand ? VOLTA_PREFIX : ''
}

interface TempFile {
  path: string
  fd: fs.FileHandle
  cleanup: () => void
}

let counter = 0

async function openTemp(): Promise<TempFile | undefined> {
  if (!existsSync(CLI_TEMP_DIR))
    await fs.mkdir(CLI_TEMP_DIR, { recursive: true })

  const competitivePath = join(CLI_TEMP_DIR, `.${process.pid}.${counter}`)
  counter++

  return fs.open(competitivePath, 'wx')
    .then(fd => ({
      fd,
      path: competitivePath,
      cleanup() {
        fd.close().then(() => {
          if (existsSync(competitivePath))
            fs.unlink(competitivePath)
        })
      },
    }))
    .catch((error: any) => {
      if (error && error.code === 'EEXIST')
        return openTemp()

      else
        return undefined
    })
}

/**
 * Write file safely avoiding conflicts
 */
export async function writeFileSafe(
  path: string,
  data: string | Buffer = '',
): Promise<boolean> {
  const temp = await openTemp()

  if (temp) {
    fs.writeFile(temp.path, data)
      .then(() => {
        const directory = dirname(path)
        if (!existsSync(directory))
          fs.mkdir(directory, { recursive: true })

        return fs.rename(temp.path, path)
          .then(() => true)
          .catch(() => false)
      })
      .catch(() => false)
      .finally(temp.cleanup)
  }

  return false
}

export function invariant(condition: unknown, errorMsg?: string) {
  if (condition)
    return

  if (errorMsg) {
    console.error(errorMsg)
    process.exit(1)
  }

  /**
   * if message is not provided
   * just silently exit
   */
  process.exit(0)
}

export function limitText(text: string, maxWidth: number) {
  if (text.length <= maxWidth)
    return text
  return `${text.slice(0, maxWidth)}${c.dim('…')}`
}
