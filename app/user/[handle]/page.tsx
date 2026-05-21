"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, Eye, MessageCircle, MoreHorizontal, Share, ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import FeedMediaGrid from "@/components/community/feed/FeedMediaGrid";
import IdentityBadge from "@/components/community/IdentityBadge";
import ReactionBar from "@/components/community/ReactionBar";
import RichContent from "@/components/stickers/RichContent";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import { CommunityPost, UserProfile, postAggregateDefaults } from "@/types/community";
import type { Badge, OshiRegistration, UserBadge } from "@/types/community";
import type { OfficialWork } from "@/types/official";
import { createNotification } from "@/lib/community/notifications";
import { enrichPostsSharedFrom } from "@/lib/community/enrichPostsSharedFrom";
import { splitFeedBodyForDisplay } from "@/lib/community/feedContentDisplay";
import { blockUser, unblockUser, checkIsBlocked } from "@/lib/supabase/profiles";
import { formatOshiPrimaryTitle, formatOshiSubtitle, getOshiList } from "@/lib/supabase/oshi";
import SharedPostOriginCard from "@/components/community/SharedPostOriginCard";

function profileName(profile: UserProfile) {
  return profile.display_name || profile.nickname || "사용자";
}

export default function UserFeedPage() {
  const params = useParams();
  const handle = decodeURIComponent(params.handle as string);
  const router = useRouter();
  
  const authUser = useAuthUser();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [oshiList, setOshiList] = useState<OshiRegistration[]>([]);
  const [interestWorks, setInterestWorks] = useState<OfficialWork[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  
  const fetchUserData = useCallback(async () => {
    setLoading(true);
    
    // 1. 프로필 가져오기
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("handle", handle)
      .single();

    // handle이 없으면 nickname으로도 찾아보기 (하위호환)
    let profile = profileData as UserProfile | null;
    if (profileError && !profileData) {
      const { data: fallbackData } = await supabase
        .from("profiles")
        .select("*")
        .eq("nickname", handle)
        .single();
      profile = fallbackData as UserProfile | null;
    }

    if (!profile) {
      setTargetProfile(null);
      setLoading(false);
      return;
    }

    setTargetProfile(profile);

    const [oshiRows, interestRows, badgeRows] = await Promise.all([
      getOshiList(profile.user_id),
      supabase
        .from("user_official_work_follows")
        .select("official_works(*)")
        .eq("user_id", profile.user_id)
        .eq("notify_enabled", true)
        .limit(8),
      supabase
        .from("user_badges")
        .select("*, badge:badges(*)")
        .eq("user_id", profile.user_id)
        .order("earned_at", { ascending: false })
        .limit(6),
    ]);

    setOshiList(oshiRows.filter((oshi) => oshi.is_public).slice(0, 5));
    if (!interestRows.error) {
      const works = ((interestRows.data ?? []) as Array<{ official_works: OfficialWork | OfficialWork[] | null }>)
        .flatMap((row) => {
          if (!row.official_works) return [];
          return Array.isArray(row.official_works) ? row.official_works : [row.official_works];
        })
        .filter((work): work is OfficialWork => Boolean(work));
      setInterestWorks(works);
    } else {
      setInterestWorks([]);
    }
    if (!badgeRows.error) {
      setUserBadges((badgeRows.data ?? []) as UserBadge[]);
    } else {
      setUserBadges([]);
    }

    // 2. 작성글 가져오기 (타인 프로필은 숨김 글 제외, 본인은 전체)
    let postsQuery = supabase
      .from("posts")
      .select("*, profiles(*)")
      .eq("author_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (authUser?.id !== profile.user_id) {
      postsQuery = postsQuery.eq("status", "NORMAL");
    }
    const { data: postsData } = await postsQuery;

    // enrich profiles with target profile
    const enrichedPosts = ((postsData as CommunityPost[] | null) ?? []).map((post) => ({
      ...post,
      profiles: post.profiles ?? profile,
    }));

    setPosts(await enrichPostsSharedFrom(enrichedPosts));

    // 3. 팔로우 여부 확인 (현재 로그인 사용자가 있는 경우)
    if (authUser?.id) {
      setCurrentUser(authUser);
      const { data: followData } = await supabase
        .from("follows_user")
        .select("*")
        .eq("follower_id", authUser.id)
        .eq("following_id", profile.user_id)
        .single();
      
      setIsFollowing(!!followData);

      // 4. 차단 여부 확인
      const blocked = await checkIsBlocked(authUser.id, profile.user_id);
      setIsBlocked(blocked);
    }
    
    setLoading(false);
  }, [handle, authUser]);

  useEffect(() => {
    if (authUser !== undefined) {
      fetchUserData();
    }
  }, [fetchUserData, authUser]);

  const toggleFollow = async () => {
    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!targetProfile || targetProfile.user_id === currentUser.id) return;

    if (isFollowing) {
      await supabase
        .from("follows_user")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", targetProfile.user_id);
      setIsFollowing(false);
    } else {
      await supabase
        .from("follows_user")
        .insert({ follower_id: currentUser.id, following_id: targetProfile.user_id });
      setIsFollowing(true);
      await createNotification({
        receiverId: targetProfile.user_id,
        senderId: currentUser.id,
        type: "FOLLOW",
        title: "새 팔로워",
        content: "회원님을 새로 팔로우했습니다.",
        linkUrl: "/profile",
      });
    }
  };

  const handleBlock = async () => {
    if (!currentUser || !targetProfile) return;
    
    if (isBlocked) {
      try {
        await unblockUser(currentUser.id, targetProfile.user_id);
        setIsBlocked(false);
      } catch (err: any) {
        alert("차단 해제 실패: " + err.message);
      }
    } else {
      if (!confirm("이 사용자를 차단하시겠습니까? 차단하면 이 사용자의 글과 댓글이 보이지 않게 됩니다.")) return;
      try {
        await blockUser(currentUser.id, targetProfile.user_id);
        setIsBlocked(true);
        // 차단 시 팔로우도 해제하는 것이 일반적
        if (isFollowing) {
          await supabase
            .from("follows_user")
            .delete()
            .eq("follower_id", currentUser.id)
            .eq("following_id", targetProfile.user_id);
          setIsFollowing(false);
        }
      } catch (err: any) {
        alert("차단 실패: " + err.message);
      }
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col border-x border-dashed border-gray-500 bg-white/40 min-h-screen">
        <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
      </main>
    );
  }

  if (!targetProfile) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col border-x border-dashed border-gray-500 bg-white/40 min-h-screen">
        <header className="flex items-center gap-4 border-b border-dashed border-gray-500 bg-white/90 p-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">사용자를 찾을 수 없음</h1>
        </header>
        <div className="p-8 text-center text-sm text-gray-500">존재하지 않거나 삭제된 사용자입니다.</div>
      </main>
    );
  }

  const isSelf = currentUser?.id === targetProfile.user_id;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col border-x border-dashed border-gray-500 bg-white/40 min-h-screen">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-dashed border-gray-500 bg-white/90 p-4 backdrop-blur-sm">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold leading-tight">{profileName(targetProfile)}</h1>
          <p className="text-xs text-gray-500">{posts.length} 게시물</p>
        </div>
      </header>

      {/* 프로필 헤더 */}
      <section className="border-b border-dashed border-gray-500 bg-white/70 p-6">
        <div className="flex items-start justify-between">
          <div className="h-20 w-20 shrink-0 overflow-hidden border border-dashed border-gray-400 bg-gray-50">
            {targetProfile.avatar_url ? (
              <img src={targetProfile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-300 font-bold uppercase italic">
                USER
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSelf ? (
              <Link
                href="/profile"
                className="border border-dashed border-gray-500 bg-white px-4 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                프로필 수정
              </Link>
            ) : (
              <button
                onClick={toggleFollow}
                className={`border border-dashed px-4 py-1.5 text-sm font-bold transition-colors ${
                  isFollowing
                    ? "border-gray-500 bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    : "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {isFollowing ? "팔로잉" : "팔로우"}
              </button>
            )}
            {!isSelf && (
              <button
                onClick={handleBlock}
                className={`border border-dashed px-3 py-1.5 text-xs font-bold transition-colors ${
                  isBlocked
                    ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                    : "border-gray-400 bg-white text-gray-500 hover:bg-gray-100 hover:text-red-500 hover:border-red-300"
                }`}
              >
                {isBlocked ? "차단됨" : "차단"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{profileName(targetProfile)}</h2>
            {targetProfile.nickname_type === "FIXED" && (
              <span className="bg-gray-800 text-white px-1 text-[10px] font-black border border-gray-800 uppercase tracking-tighter leading-tight">
                FIXED
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">@{targetProfile.handle || targetProfile.nickname}</p>
        </div>

        {targetProfile.bio && (
          <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{targetProfile.bio}</p>
        )}

        <ProfileTasteSummary
          oshiList={oshiList}
          interestWorks={interestWorks}
          userBadges={userBadges}
        />
      </section>

      {/* 탭 영역 (현재는 글만) */}
      <div className="border-b border-dashed border-gray-500 bg-white/90 px-4 py-3">
        <span className="border-b-2 border-gray-800 pb-3 text-sm font-bold text-gray-900">
          작성한 글
        </span>
      </div>

      <section className="flex flex-col">
        {posts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            아직 작성한 게시물이 없습니다.
          </div>
        ) : (
          posts.map((post) => {
            const stats = postAggregateDefaults(post);
            const { body, imageUrls, shareHeaderLine } = splitFeedBodyForDisplay(post.content);
            const authorHandle =
              post.profiles?.handle || post.profiles?.nickname || post.author_email?.split("@")[0] || "익명";
            const isBoardShareFeed = post.source_type === "FEED" && !!post.origin_post_id;

            return (
              <article
                key={post.id}
                className="border-b border-dashed border-gray-500 bg-white/70 px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex gap-3">
                  <div className="pt-1">
                    <IdentityBadge
                      profile={post.profiles}
                      fallback={{ nickname: authorHandle }}
                      size="md"
                      showAvatar={true}
                      showName={false}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 text-sm text-gray-500 flex-wrap">
                        <IdentityBadge
                          profile={post.profiles}
                          fallback={{ nickname: authorHandle }}
                          size="md"
                          showAvatar={false}
                          showName={true}
                        />
                        <span className="truncate">@{authorHandle}</span>
                        <span>· {formatCommunityDate(post.created_at)}</span>
                      </div>
                      <button className="text-gray-500 hover:text-gray-900">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>

                    {isBoardShareFeed ? (
                      <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5">
                        <SharedPostOriginCard
                          post={post}
                          shareHeaderFallback={post.shared_from ? null : shareHeaderLine}
                          variant="unified"
                        />
                        {body || imageUrls.length > 0 ? (
                          <div className="mt-2 border-t border-dashed border-gray-200 pt-2.5">
                            {body ? <RichContent content={body} /> : null}
                            <FeedMediaGrid imageUrls={imageUrls} />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        {post.source_type === "BOARD" ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                            <span className="border border-dashed border-gray-300 px-1.5 py-0.5">게시판</span>
                            {post.is_hot && (
                              <span className="border border-dashed border-gray-300 bg-white px-1.5 py-0.5 text-gray-700">인기</span>
                            )}
                          </div>
                        ) : null}

                        {post.title && post.source_type === "BOARD" && (
                          <h2 className="mt-2 font-bold text-gray-950">{post.title}</h2>
                        )}

                        {body || imageUrls.length > 0 ? (
                          <div className="mt-2">
                            {body ? <RichContent content={body} /> : null}
                            <FeedMediaGrid imageUrls={imageUrls} />
                          </div>
                        ) : null}
                      </>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-500">
                      <button className="flex items-center gap-1 hover:text-gray-900">
                        <MessageCircle size={17} />
                        {stats.comment_count}
                      </button>
                      <ReactionBar
                        postId={post.id}
                        viewerId={currentUser?.id ?? null}
                        authorId={post.author_id ?? undefined}
                      />
                      <span className="flex items-center gap-1">
                        <Eye size={17} />
                        {stats.view_count}
                      </span>
                      <button className="hover:text-gray-900"><Bookmark size={17} /></button>
                      <button className="hover:text-gray-900"><Share size={17} /></button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

function ProfileTasteSummary({
  oshiList,
  interestWorks,
  userBadges,
}: {
  oshiList: OshiRegistration[];
  interestWorks: OfficialWork[];
  userBadges: UserBadge[];
}) {
  const mainOshi = oshiList.find((oshi) => oshi.rank === 1) ?? oshiList[0];
  const subOshi = oshiList.filter((oshi) => oshi.id !== mainOshi?.id).slice(0, 4);
  const badges = userBadges
    .map((userBadge) => userBadge.badge)
    .filter((badge): badge is Badge => Boolean(badge))
    .slice(0, 4);

  if (!mainOshi && interestWorks.length === 0 && badges.length === 0) return null;

  return (
    <div className="mt-5 space-y-3 border-t border-dashed border-gray-300 pt-4">
      {mainOshi ? (
        <div className="flex gap-3 border border-dashed border-gray-400 bg-white/80 p-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
            {mainOshi.image_url ? (
              <img
                src={mainOshi.image_url}
                alt={formatOshiPrimaryTitle(mainOshi)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] font-bold text-gray-400">
                OSHI
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Main oshi
            </p>
            <p className="truncate text-sm font-bold text-gray-950">
              {formatOshiPrimaryTitle(mainOshi)}
            </p>
            {(formatOshiSubtitle(mainOshi) || mainOshi.description) && (
              <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                {formatOshiSubtitle(mainOshi) ?? mainOshi.description}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {subOshi.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {subOshi.map((oshi) => (
            <span
              key={oshi.id}
              className="max-w-full truncate border border-dashed border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700"
            >
              #{oshi.rank} {formatOshiPrimaryTitle(oshi)}
            </span>
          ))}
        </div>
      ) : null}

      {interestWorks.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            관심작
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {interestWorks.slice(0, 4).map((work) => (
              <div key={work.id} className="min-w-0 border border-dashed border-gray-300 bg-white/80 p-2">
                <p className="truncate text-[11px] font-bold text-gray-900">{work.title}</p>
                {work.original_title ? (
                  <p className="truncate text-[10px] text-gray-400">{work.original_title}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.id}
              className="inline-flex items-center gap-1 border border-dashed border-yellow-300 bg-yellow-50 px-2 py-1 text-[11px] font-bold text-yellow-800"
            >
              <span>{badge.icon}</span>
              {badge.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
