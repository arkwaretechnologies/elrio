
"use client";

import React, { useState } from 'react';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { UserForm } from '@/components/user-form';
import { addUser, updateUser, deleteUser } from '@/services/user-service';

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

export function UserManagementClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [addEditDialog, setAddEditDialog] = useState<DialogState<User>>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<DialogState<User>>({ open: false, data: null });
  const { toast } = useToast();

  const handleSaveUser = async (userData: Partial<Omit<User, 'id'>>, userId?: string) => {
    try {
      if (userId) {
        // Update user
        await updateUser(userId, userData);
        setUsers(users.map(u => u.id === userId ? { ...u, ...userData } as User : u));
        toast({
          title: 'User Updated',
          description: `${userData.fullName}'s details have been updated.`,
        });
      } else {
        // Add new user, ensuring password is set
        if (!userData.password) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Password is required for new users.',
            });
            return;
        }
        const newUser = await addUser(userData as Omit<User, 'id'>);
        setUsers([...users, newUser]);
        toast({
          title: 'User Added',
          description: `${newUser.fullName} has been added.`,
        });
      }
      setAddEditDialog({ open: false, data: null });
    } catch (error) {
      console.error('Failed to save user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save user details.',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.data) return;
    try {
      await deleteUser(deleteDialog.data.id);
      setUsers(users.filter(u => u.id !== deleteDialog.data!.id));
      toast({
        title: 'User Deleted',
        description: `User "${deleteDialog.data.fullName}" has been deleted.`,
      });
      setDeleteDialog({ open: false, data: null });
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete user.',
      });
    }
  };

  const openAddDialog = () => setAddEditDialog({ open: true, data: null });
  const openEditDialog = (user: User) => setAddEditDialog({ open: true, data: user });
  const openDeleteDialog = (user: User) => setDeleteDialog({ open: true, data: user });
  
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setAddEditDialog({ open: false, data: null });
    } else {
      setAddEditDialog(prev => ({ ...prev, open: true }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage system users and their permissions.</p>
        </div>
        <Dialog open={addEditDialog.open} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{addEditDialog.data ? 'Edit User' : 'Add New User'}</DialogTitle>
            </DialogHeader>
            <UserForm 
              user={addEditDialog.data} 
              onSave={handleSaveUser}
              onCancel={() => setAddEditDialog({ open: false, data: null })}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.username}</TableCell>
                    <TableCell>
                        <Badge variant="secondary">{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'destructive'} className={user.isActive ? 'bg-green-100 text-green-800' : ''}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(user)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for "{deleteDialog.data?.fullName}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog({ open: false, data: null })}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
