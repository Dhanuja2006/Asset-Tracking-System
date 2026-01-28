import { useEffect, useState } from "react";
import { fetchAPI, postAPI } from "../api/api";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select";
import {
  Users,
  Shield,
  UserPlus,
  Edit,
  Trash2,
  Key
} from "lucide-react";

/* ---------- Types ---------- */
type Role = {
  role_id: number;
  role_name: string;
};

type User = {
  user_id: number;
  name: string;
  email: string;
  role_name: string;
  department_name: string;
};

export function UserRoleManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("");

  /* ---------- Fetch ---------- */
  useEffect(() => {
    fetchAPI<User[]>("/users").then(setUsers);
    fetchAPI<Role[]>("/roles").then(setRoles);
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-purple-100 text-purple-800";
      case "Biomedical Engineer":
        return "bg-blue-100 text-blue-800";
      case "Doctor":
        return "bg-green-100 text-green-800";
      case "Nurse":
        return "bg-pink-100 text-pink-800";
      case "Inventory Manager":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail || !newUserRole) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await postAPI("/users", {
        name: newUserName,
        email: newUserEmail,
        role_id: parseInt(newUserRole)
      });

      // Refresh users list
      const updatedUsers = await fetchAPI<User[]>("/users");
      setUsers(updatedUsers);
      
      // Reset form and close dialog
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("");
      setIsDialogOpen(false);
      alert("User added successfully!");
    } catch (error) {
      console.error("Error adding user:", error);
      alert(`Error adding user: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            User & Role Management
          </h2>
          <p className="text-muted-foreground">
            Manage users, roles, and access permissions
          </p>
        </div>

        {/* Add User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div>
                <Label>Name</Label>
                <Input 
                  placeholder="John Doe" 
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input 
                  type="email" 
                  placeholder="john@hospital.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>

              <div>
                <Label>Role</Label>
                <Select value={newUserRole} onValueChange={setNewUserRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem
                        key={r.role_id}
                        value={r.role_id.toString()}
                      >
                        {r.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddUser}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Stats */}
      <div className="grid md:grid-cols-5 gap-4">
        {roles.map(role => {
          const count = users.filter(
            u => u.role_name === role.role_name
          ).length;

          return (
            <Card key={role.role_id}>
              <CardHeader className="flex justify-between pb-2">
                <CardTitle className="text-sm">
                  {role.role_name}
                </CardTitle>
                <Shield className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
          <CardDescription>User accounts</CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {users.map(u => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {u.user_id}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>{u.email}</TableCell>

                  <TableCell>
                    <Badge className={getRoleColor(u.role_name)}>
                      {u.role_name}
                    </Badge>
                  </TableCell>

                  <TableCell>{u.department_name}</TableCell>

                  
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}