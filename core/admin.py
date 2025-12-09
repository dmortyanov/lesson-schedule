from django.contrib import admin
from . import models


@admin.register(models.Department)
class DepartmentAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(models.GroupModel)
class GroupAdmin(admin.ModelAdmin):
    list_display = ["name", "department", "year"]
    list_filter = ["department", "year"]
    search_fields = ["name"]


@admin.register(models.Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ["user", "department", "title"]
    list_filter = ["department"]
    search_fields = ["user__username", "user__first_name", "user__last_name"]


@admin.register(models.Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["user", "group"]
    list_filter = ["group"]
    search_fields = ["user__username", "user__first_name", "user__last_name"]


@admin.register(models.Discipline)
class DisciplineAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(models.Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ["name", "capacity", "room_type"]
    list_filter = ["room_type"]
    search_fields = ["name"]


@admin.register(models.Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["discipline", "group", "teacher", "room", "start_time", "end_time"]
    list_filter = ["group", "teacher", "room"]
    search_fields = ["discipline__name", "group__name", "teacher__user__last_name"]


@admin.register(models.ChangeRequest)
class ChangeRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "created_by", "state", "created_at"]
    list_filter = ["state", "created_at"]

