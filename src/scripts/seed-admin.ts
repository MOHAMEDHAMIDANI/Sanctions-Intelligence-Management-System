import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../user/user.service';
import { RoleEnum } from '../common/enums/role.enum';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);

  const adminEmail = 'mohamidani1@gmail.com';

  try {
    const existing = await userService.findOneBy({ email: adminEmail });
    if (existing) {
      console.log(`User ${adminEmail} already exists.`);

      // Ensure it's confirmed for testing
      if (!existing.isConfirmed) {
        await userService.update(existing.id, { isConfirmed: true } as any);
        console.log(`User ${adminEmail} has been marked as confirmed.`);
      }
    } else {
      // Create a super admin
      const admin = await userService.create({
        firstName: 'System',
        lastName: 'Administrator',
        email: adminEmail,
        phone: '+213000000000',
        role: RoleEnum.SUPER_ADMIN,
      } as any);

      // Mark as confirmed directly for testing
      await userService.update(admin.id, { isConfirmed: true } as any);

      console.log('****************************************');
      console.log('Admin user created successfully!');
      console.log(`Email: ${adminEmail}`);
      console.log('Status: Confirmed');
      console.log('Role: SUPER_ADMIN');
      console.log('****************************************');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
