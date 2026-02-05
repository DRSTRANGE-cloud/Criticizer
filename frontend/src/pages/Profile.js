import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaCalendar, FaStar } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const RATING_OPTIONS = [
  { label: 'Absolute Cinema', value: 'Absolute Cinema', emoji: '🎭', color: 'bg-purple-600' },
  { label: 'Peak', value: 'Peak', emoji: '⭐', color: 'bg-indigo-600' },
  { label: 'Excellent', value: 'Excellent', emoji: '🌟', color: 'bg-blue-600' },
  { label: 'Good', value: 'Good', emoji: '👍', color: 'bg-green-600' },
  { label: 'Go for it', value: 'Go for it', emoji: '✓', color: 'bg-yellow-600' },
  { label: 'Not my type', value: 'Not my type', emoji: '👎', color: 'bg-red-600' },
];

const Profile = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchUserReviews();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/profile/${userId}`);
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserReviews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reviews/user/${userId}`);
      setReviews(response.data.reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-20">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-20">
        <div className="text-white text-2xl">User not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-28 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-critisizer-gray rounded-lg p-8 mb-8">
          <div className="flex items-center space-x-6">
            <img
              src={profile.avatar}
              alt={profile.username}
              className="w-24 h-24 rounded-full"
              data-testid="profile-avatar"
            />
            <div>
              <h1 className="text-3xl font-bold text-white mb-2" data-testid="profile-username">
                {profile.username}
              </h1>
              <div className="flex items-center space-x-4 text-gray-400">
                <div className="flex items-center space-x-2">
                  <FaCalendar />
                  <span>Joined {new Date(profile.joined_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FaStar />
                  <span>{profile.total_reviews} Reviews</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <h2 className="text-2xl font-bold text-white mb-6">Reviews</h2>
        {reviews.length === 0 ? (
          <div className="bg-critisizer-gray rounded-lg p-12 text-center">
            <p className="text-gray-400 text-xl">No reviews yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review) => {
              const ratingOption = RATING_OPTIONS.find(opt => opt.value === review.rating_category);
              return (
                <div
                  key={review.review_id}
                  className="bg-critisizer-gray rounded-lg p-6 cursor-pointer hover:bg-gray-800 transition"
                  onClick={() => navigate(`/movie/${review.movie_id}`)}
                  data-testid="profile-review-item"
                >
                  <div className="flex space-x-4">
                    {review.movie_poster && (
                      <img
                        src={review.movie_poster}
                        alt={review.movie_title}
                        className="w-20 h-30 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-2">{review.movie_title}</h3>
                      {ratingOption && (
                        <span className={`${ratingOption.color} px-3 py-1 rounded-full text-white text-sm inline-flex items-center space-x-1 mb-3`}>
                          <span>{ratingOption.emoji}</span>
                          <span>{ratingOption.label}</span>
                        </span>
                      )}
                      <p className="text-gray-300 mt-2 line-clamp-3">{review.review_text}</p>
                      <p className="text-gray-500 text-sm mt-2">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;