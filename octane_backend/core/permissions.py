from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Allows access only to Admin users (is_staff, is_superuser, or Admin group).
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or request.user.is_superuser or request.user.groups.filter(name='Admin').exists())
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access (GET, HEAD, OPTIONS) for any authenticated user (Cashier or Admin).
    Write operations (POST, PUT, PATCH, DELETE) require Admin permissions.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return bool(
            request.user.is_staff or 
            request.user.is_superuser or 
            request.user.groups.filter(name='Admin').exists()
        )


class IsAdminOrPublicReadOnly(permissions.BasePermission):
    """
    Allows read-only access (GET, HEAD, OPTIONS) publicly so Login page can display shop name and logo.
    Write operations (POST, PUT, PATCH, DELETE) require Admin permissions.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or request.user.is_superuser or request.user.groups.filter(name='Admin').exists())
        )


class IsAdminOrCanCreateCustomer(permissions.BasePermission):
    """
    Allows GET and POST (creating customers during POS billing) for authenticated Cashiers & Admins.
    Modification (PUT, PATCH) and deletion (DELETE) require Admin permissions.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.method in permissions.SAFE_METHODS or request.method == 'POST':
            return True

        return bool(
            request.user.is_staff or 
            request.user.is_superuser or 
            request.user.groups.filter(name='Admin').exists()
        )


class IsAdminOrCanCreateInvoice(permissions.BasePermission):
    """
    Allows GET and POST (POS Checkout) for authenticated Cashiers & Admins.
    Modification (PUT, PATCH) and deletion/cancellation (DELETE) require Admin permissions.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.method in permissions.SAFE_METHODS or request.method == 'POST':
            return True

        return bool(
            request.user.is_staff or 
            request.user.is_superuser or 
            request.user.groups.filter(name='Admin').exists()
        )
