import Dexie, { type EntityTable } from 'dexie'

export interface Project {
  id?: number
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface PresentationPage {
  id?: number
  projectId: number
  pageNumber: number
  title?: string
  description?: string
  code?: string
  codeLanguage?: string
  createdAt: Date
  updatedAt: Date
}

const db = new Dexie('PresentationsDB') as Dexie & {
  projects: EntityTable<Project, 'id'>
  pages: EntityTable<PresentationPage, 'id'>
}

db.version(1).stores({
  projects: '++id, name, createdAt, updatedAt'
})

db.version(2).stores({
  projects: '++id, name, createdAt, updatedAt',
  pages: '++id, projectId, pageNumber, createdAt, updatedAt'
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
    // Clear all projects and pages
    await db.projects.clear()
    await db.pages.clear()
    
    // Force reset the auto-increment counter by recreating the database
    await db.close()
    await db.delete()
    
    // Reopen the database (this will recreate it with fresh auto-increment)
    await db.open()
  }

  // Page management methods
  static async getProjectPages(projectId: number): Promise<PresentationPage[]> {
    const pages = await db.pages.where('projectId').equals(projectId).toArray()
    return pages.sort((a, b) => a.pageNumber - b.pageNumber)
  }

  static async getPage(pageId: number): Promise<PresentationPage | undefined> {
    return await db.pages.get(pageId)
  }

  static async createPage(projectId: number): Promise<number> {
    const existingPages = await this.getProjectPages(projectId)
    const pageNumber = existingPages.length + 1
    const now = new Date()
    
    const id = await db.pages.add({
      projectId,
      pageNumber,
      createdAt: now,
      updatedAt: now
    })
    return id as number
  }

  static async updatePage(pageId: number, updates: Partial<Omit<PresentationPage, 'id' | 'projectId' | 'pageNumber' | 'createdAt'>>): Promise<void> {
    await db.pages.update(pageId, {
      ...updates,
      updatedAt: new Date()
    })
  }

  static async clonePage(pageId: number): Promise<number> {
    const originalPage = await this.getPage(pageId)
    if (!originalPage) throw new Error('Page not found')

    const existingPages = await this.getProjectPages(originalPage.projectId)
    const newPageNumber = existingPages.length + 1
    const now = new Date()
    
    const id = await db.pages.add({
      projectId: originalPage.projectId,
      pageNumber: newPageNumber,
      title: originalPage.title,
      description: originalPage.description,
      code: originalPage.code,
      codeLanguage: originalPage.codeLanguage,
      createdAt: now,
      updatedAt: now
    })
    return id as number
  }

  static async deletePage(pageId: number): Promise<void> {
    const page = await this.getPage(pageId)
    if (!page) return

    // Delete the page
    await db.pages.delete(pageId)
    
    // Renumber remaining pages
    const remainingPages = await this.getProjectPages(page.projectId)
    for (let i = 0; i < remainingPages.length; i++) {
      const currentPage = remainingPages[i]
      if (currentPage.pageNumber !== i + 1) {
        await db.pages.update(currentPage.id!, { pageNumber: i + 1 })
      }
    }
  }

  static async deleteMultiplePages(pageIds: number[]): Promise<void> {
    if (pageIds.length === 0) return
    
    // Get first page to determine project
    const firstPage = await this.getPage(pageIds[0])
    if (!firstPage) return
    
    // Delete all specified pages
    await db.pages.bulkDelete(pageIds)
    
    // Renumber remaining pages
    const remainingPages = await this.getProjectPages(firstPage.projectId)
    for (let i = 0; i < remainingPages.length; i++) {
      const currentPage = remainingPages[i]
      if (currentPage.pageNumber !== i + 1) {
        await db.pages.update(currentPage.id!, { pageNumber: i + 1 })
      }
    }
  }

  static async deleteAllProjectPages(projectId: number): Promise<void> {
    await db.pages.where('projectId').equals(projectId).delete()
  }
}

export { db }