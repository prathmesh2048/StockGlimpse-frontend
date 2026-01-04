import React from "react";
import Navbar from "../Navbar/Navbar";
import useUser from "../hooks/useUser";
import { Puff } from "react-loader-spinner";

export default function Profile() {
    const { user, loading } = useUser();

    if (loading) {
        return (
            <>
                <Navbar solidBackground />
                <div className="flex justify-center items-center h-[70vh]">
                    <Puff color="#6366F1" size={60} />
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar solidBackground />

            <div className="max-w-xl mx-auto mt-10 px-4">
                <h2 className="text-2xl font-semibold mb-6">Profile</h2>

                <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
                    {/* First Name */}
                    <div className="flex justify-between border-b pb-3">
                        <span className="text-gray-500">First Name</span>
                        <span className="font-medium">{user?.first_name || "-"}</span>
                    </div>

                    {/* Last Name */}
                    <div className="flex justify-between border-b pb-3">
                        <span className="text-gray-500">Last Name</span>
                        <span className="font-medium">{user?.last_name || "-"}</span>
                    </div>

                    {/* Email */}
                    <div className="flex justify-between">
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium">{user?.email || "-"}</span>
                    </div>
                </div>
            </div>
        </>
    );
}

