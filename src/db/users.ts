import { db } from './index.ts';
import { users, nutritionGoals } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name?.trim() || cleanEmail.split('@')[0];

    // Upsert into users table
    const result = await db
      .insert(users)
      .values({
        id: uid,
        uid,
        email: cleanEmail,
        name: cleanName,
        role: 'MEMBER',
        status: 'ACTIVE',
        allowAdminView: true,
        adminAccessDecided: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          uid,
          name: cleanName,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = result[0];

    // Ensure default nutrition goals exist
    await db
      .insert(nutritionGoals)
      .values({
        userId: user.id,
        dailyCalories: '2200',
        dailyProtein: '120',
      })
      .onConflictDoNothing();

    return user;
  } catch (error) {
    console.error('Database getOrCreateUser failed:', error);
    throw new Error('Database user sync failed', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database getUserByEmail failed:', error);
    throw new Error('Database query failed', { cause: error });
  }
}

export async function getUserById(id: string) {
  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database getUserById failed:', error);
    throw new Error('Database query failed', { cause: error });
  }
}
