"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Layers,
  Database,
  Trash2,
  ExternalLink,
  ArrowRight,
  Search,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        setIsModalOpen(false);
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project and all its services?")) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 ">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 ">Projects & Environments</h1>
          <p className="text-sm text-slate-500  mt-0.5">
            Create and orchestrate multiple isolated environments for staging, production, or microservices.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-md shadow-pink-500/20">
          <Plus className="h-4 w-4" />
          Create New Project
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 ">Loading environments...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300  bg-white ">
          <div className="h-12 w-12 rounded-2xl bg-pink-50  text-pink-500 flex items-center justify-center mx-auto mb-3 border border-pink-100 ">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 ">No projects found</h3>
          <p className="text-xs text-slate-500  max-w-sm mx-auto mt-1 mb-4">
            Create a project environment to deploy web apps, databases, and Docker compose stacks.
          </p>
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Create Project
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((proj) => (
            <Link key={proj.id} href={`/projects/${proj.id}`}>
              <Card className="hover:border-pink-300 :border-pink-900/50 hover:shadow-md transition-all h-full flex flex-col justify-between group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-50 to-rose-50   text-pink-600  flex items-center justify-center border border-pink-200/80  font-bold text-sm shadow-sm">
                        {proj.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900  group-hover:text-pink-600 :text-pink-400 transition-colors">
                          {proj.name}
                        </CardTitle>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(proj.id, e)}
                      title="Delete project"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 :bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {proj.description && (
                    <CardDescription className="line-clamp-2 mt-2 text-xs">
                      {proj.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-3 border-t border-slate-100  flex items-center justify-between text-xs text-slate-600  bg-slate-50/50  p-4 rounded-b-xl">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers className="h-3.5 w-3.5 text-emerald-600 " />
                      {proj.applicationsCount || 0} Apps
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Database className="h-3.5 w-3.5 text-pink-500 " />
                      {proj.databasesCount || 0} DBs
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400  group-hover:text-pink-600 :text-pink-400 group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project Environment"
        description="A project is an isolated namespace to deploy multiple apps and databases."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Project Name *</label>
            <Input
              placeholder="e.g. production-crm, staging-api, personal-blog"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
            <Input
              placeholder="Short description of this project environment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
