import Dexie, { type EntityTable } from 'dexie'

export interface Project {
  id?: number
  name: string
  createdAt: Date
  updatedAt: Date
}

const db = new Dexie('PresentationsDB') as Dexie & {
  projects: EntityTable<Project, 'id'>
}

db.version(1).stores({
  projects: '++id, name, createdAt, updatedAt'
})

export class DatabaseService {
  static async getAllProjects(): Promise<Project[]> {
    return await db.projects.orderBy('createdAt').reverse().toArray()
  }

  static async getProject(id: number): Promise<Project | undefined> {
    return await db.projects.get(id)
  }

  static async createProject(name: string): Promise<number> {
    const now = new Date()
    const id = await db.projects.add({
      name,
      createdAt: now,
      updatedAt: now
    })
    return id as number
  }

  static async updateProject(id: number, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
    await db.projects.update(id, {
      ...updates,
      updatedAt: new Date()
    })
  }

  static async deleteProject(id: number): Promise<void> {
    await db.projects.delete(id)
  }

  static async getNextId(): Promise<number> {
    const lastProject = await db.projects.orderBy('id').reverse().first()
    return lastProject ? lastProject.id! + 1 : 1
  }

  static async deleteAllProjects(): Promise<void> {
    // Clear all projects
    await db.projects.clear()
    
    // Force reset the auto-increment counter by recreating the database
    await db.close()
    await db.delete()
    
    // Reopen the database (this will recreate it with fresh auto-increment)
    await db.open()
  }
}

export { db }