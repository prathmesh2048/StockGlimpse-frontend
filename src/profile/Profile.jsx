import React from "react";
import "./Profile.css";
import Navbar from "../Navbar/Navbar";

export default function Profile() {

    return (
        <>
            <Navbar solidBackground={true} />

            <div className="profile-container">

                <h2 className="profile-title">Profile</h2>

                <div className="profile-card">
                    {/* Name + Profile Picture */}
                    <div className="profile-row">
                        <div className="profile-label">Name</div>
                        <div className="profile-value profile-name-with-pic">
                            <img
                                src="/images/sea-lion.png"
                                alt="Profile"
                                className="profile-pic"
                            />
                            <span>Prathmesh Ajay Nandurkar</span>
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="profile-row">
                        <div className="profile-label">Phone Number</div>
                        <div className="profile-value">+91 7769933725</div>
                    </div>

                    {/* Email */}
                    <div className="profile-row">
                        <div className="profile-label">Email</div>
                        <div className="profile-value">
                            <div className="profile-main">prathmeshnandurkar123@gmail.com</div>
                            <div className="profile-sub">This is your unique ID</div>
                        </div>
                    </div>

                    {/* Username */}
                    <div className="profile-row">
                        <div className="profile-label">Username</div>
                        <div className="profile-value">@pratnand763</div>
                    </div>
                </div>



            </div>

        </>
    )
}
