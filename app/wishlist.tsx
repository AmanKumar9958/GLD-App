import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWishlist, WishlistCourse } from "../context/WishlistContext";

function getCategoryIcon(
  category: WishlistCourse["category"],
): React.ComponentProps<typeof Ionicons>["name"] {
  if (category === "English Spoken") {
    return "people-outline";
  }

  if (category === "Academics") {
    return "school-outline";
  }

  return "ribbon-outline";
}

export default function WishlistScreen() {
  const router = useRouter();
  const { wishlist, wishlistCount, removeFromWishlist } = useWishlist();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1E3989" />
        </Pressable>

        <Text style={styles.pageTitle}>Wishlist</Text>

        <View style={styles.countPill}>
          <Text style={styles.countText}>{wishlistCount}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {wishlist.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={28} color="#8090C0" />
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add courses from All Courses using the heart button.
            </Text>
          </View>
        ) : null}

        {wishlist.map((course) => (
          <View key={course.id} style={styles.courseCard}>
            <Image source={{ uri: course.image }} style={styles.courseImage} />

            <View style={styles.courseContent}>
              <View style={styles.titleRow}>
                <Text style={styles.courseTitle} numberOfLines={1}>
                  {course.title}
                </Text>
                <Text style={styles.priceTag}>{course.price}</Text>
              </View>

              <Text style={styles.mentorText} numberOfLines={1}>
                by {course.mentor}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name={getCategoryIcon(course.category)}
                    size={14}
                    color="#1E3989"
                  />
                  <Text style={styles.metaText}>{course.category}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="layers-outline" size={14} color="#1E3989" />
                  <Text style={styles.metaText}>{course.level}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="book-outline" size={14} color="#8090C0" />
                  <Text style={styles.secondaryMetaText}>
                    {course.lessons} lessons
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="#8090C0" />
                  <Text style={styles.secondaryMetaText}>
                    {course.duration}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.removeBtn}
              onPress={() => removeFromWishlist(course.id)}
              hitSlop={6}
            >
              <Ionicons name="heart" size={18} color="#DC2626" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F4FB",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  pageTitle: {
    fontSize: 20,
    color: "#1E3989",
    fontWeight: "700",
  },
  countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#1E3989",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 12,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: "#D5E2F5",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    color: "#1E3989",
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#8090C0",
    textAlign: "center",
    fontWeight: "500",
  },
  courseCard: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E2F5",
    overflow: "hidden",
    position: "relative",
  },
  courseImage: {
    width: 108,
    height: 128,
    backgroundColor: "#D5E2F5",
  },
  courseContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  courseTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E3989",
  },
  priceTag: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
    backgroundColor: "#1E3989",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  mentorText: {
    fontSize: 12,
    color: "#8090C0",
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "52%",
  },
  metaText: {
    fontSize: 11,
    color: "#1E3989",
    fontWeight: "600",
  },
  secondaryMetaText: {
    fontSize: 11,
    color: "#8090C0",
    fontWeight: "500",
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F8C6C6",
  },
});
