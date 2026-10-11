from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import (
    BusinessProfile, Partner, ProductCategory, Product, ServiceCategory, Service
)


class Command(BaseCommand):
    help = "Seed initial business profile, admin user, partners, and sample product/service categories."

    def handle(self, *args, **options):
        # 1. Create Default Admin User
        admin_user, created = User.objects.get_or_create(username='admin')
        if created:
            admin_user.set_password('admin123')
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user (username: 'admin', password: 'admin123')"))

        # 2. Create Business Profile
        profile, p_created = BusinessProfile.objects.get_or_create(id=1)
        if p_created:
            self.stdout.write(self.style.SUCCESS("Created default BusinessProfile for Octane Systems"))

        # 3. Create Partners: Ramesh & Lokesh
        ramesh, _ = Partner.objects.get_or_create(
            name="Ramesh",
            defaults={"ownership_percentage": 50.00}
        )
        lokesh, _ = Partner.objects.get_or_create(
            name="Lokesh",
            defaults={"ownership_percentage": 50.00}
        )
        self.stdout.write(self.style.SUCCESS("Partners initialized: Ramesh & Lokesh"))

        # 4. Seed Product Categories
        prod_categories = [
            "Laptop",
            "Laptop Accessories",
            "Mobile",
            "Mobile Accessories",
            "CCTV Parts",
            "Printer & Printer Accessories",
        ]
        for cat_name in prod_categories:
            ProductCategory.objects.get_or_create(name=cat_name)
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(prod_categories)} Product Categories"))

        # 5. Seed Sample Products
        laptop_cat = ProductCategory.objects.get(name="Laptop")
        acc_cat = ProductCategory.objects.get(name="Laptop Accessories")
        
        Product.objects.get_or_create(
            sku="LAP-DELL-5450",
            defaults={
                "name": "Dell Latitude 5450 Laptop",
                "category": laptop_cat,
                "brand": "Dell",
                "hsn_sac": "84713010",
                "unit": "NOS",
                "purchase_price": 42000.00,
                "selling_price": 50000.00,
                "gst_rate": 18.00,
                "is_stock_enabled": True,
                "tracking_type": "SERIAL_NUMBER"
            }
        )

        Product.objects.get_or_create(
            sku="RAM-16GB-DDR4",
            defaults={
                "name": "16GB DDR4 RAM",
                "category": acc_cat,
                "brand": "Crucial",
                "hsn_sac": "84733020",
                "unit": "NOS",
                "purchase_price": 2200.00,
                "selling_price": 3000.00,
                "gst_rate": 18.00,
                "is_stock_enabled": True,
                "tracking_type": "QUANTITY"
            }
        )

        # 6. Seed Service Categories & Services
        serv_cat, _ = ServiceCategory.objects.get_or_create(name="Computer & Laptop Services")
        
        Service.objects.get_or_create(
            service_name="Windows Installation Service",
            defaults={
                "category": serv_cat,
                "sac": "998313",
                "default_rate": 500.00,
                "gst_rate": 18.00,
                "description": "Clean installation of Windows OS & drivers"
            }
        )

        Service.objects.get_or_create(
            service_name="RAM Replacement Labor",
            defaults={
                "category": serv_cat,
                "sac": "998313",
                "default_rate": 300.00,
                "gst_rate": 18.00,
                "description": "Hardware installation labor for RAM upgrade"
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeding completed successfully!"))
